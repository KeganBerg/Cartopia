-- BuildingBuilder: builds Cartopia's buildings in Roblox from the web game's own models, one
-- model per level, so a building visibly gains detail each time it levels up (the web game
-- redraws it per level: src/scene/BuildingModel.tsx and the files it imports). The parts come
-- from Data/Buildings/<id> (scripts/roblox/models.mjs). Copied into the kit by export.mjs.
--
--   local Builder = require(ReplicatedStorage.CartopiaData.BuildingBuilder)
--   Builder.init({ buildings = ReplicatedStorage.CartopiaData.Buildings,
--                  assets = require(ReplicatedStorage.CartopiaData.ModelAssets) })
--   local model = Builder.build("pizza", 3, plotCFrame)   -- a Model, parented by you
--   Builder.setLevel(model, 4)                            -- adds and removes only what changed, with a pop
--   Builder.setNight(model, true)                         -- windows and signs glow
--
-- The model's pivot is the middle of its lot at ground level, facing -Z (the street side in
-- the web game is +Z, so turn the plot CFrame to face the road). Every visible part is
-- Anchored with collisions, touches and queries off; one invisible "Hitbox" part covers the
-- building for walking into and tapping.

local TweenService = game:GetService("TweenService")

local Builder = {}

-- Studs per web unit. A web townsperson is 0.9 units tall and a Roblox avatar about 5 studs,
-- so 5.5 keeps people, doors and cars the same size against each other. A lot tile is 2 units (11 studs).
Builder.studsPerUnit = 5.5
Builder.tile = 2

-- Roblox materials for the web game's textures (src/scene/textures.ts). The texture image
-- itself is laid on top once it is uploaded (ModelAssets.Images); until then the material
-- carries the look.
local MATERIAL = {
	brick = Enum.Material.Brick,
	siding = Enum.Material.WoodPlanks,
	shingle = Enum.Material.Slate,
	gravel = Enum.Material.Pebble,
	pavers = Enum.Material.Pavement,
	concrete = Enum.Material.Concrete,
	asphalt = Enum.Material.Asphalt,
	sand = Enum.Material.Sand,
	beachsand = Enum.Material.Sand,
	grass = Enum.Material.Grass,
	meadow = Enum.Material.Grass,
	dirt = Enum.Material.Ground,
	soil = Enum.Material.Ground,
	snow = Enum.Material.Snow,
	corrugated = Enum.Material.CorrodedMetal,
	container = Enum.Material.CorrodedMetal,
	awning = Enum.Material.Fabric,
	curtain = Enum.Material.Fabric,
	window = Enum.Material.Glass,
	tower = Enum.Material.Glass,
	water = Enum.Material.Glass,
}
local THIN = 0.006 -- matches models.mjs: flat pieces (signs, decals, windows) are slabs this thick
local NAMES = { Enum.NormalId.Right, Enum.NormalId.Left, Enum.NormalId.Top, Enum.NormalId.Bottom, Enum.NormalId.Back, Enum.NormalId.Front }

local cfg = { buildings = nil, assets = { Meshes = {}, Images = {} } }
local cache = {}

function Builder.init(opts)
	cfg.buildings = opts.buildings
	cfg.assets = opts.assets or cfg.assets
	if opts.studsPerUnit then
		Builder.studsPerUnit = opts.studsPerUnit
	end
end

function Builder.data(id)
	if not cache[id] then
		local mod = cfg.buildings and cfg.buildings:FindFirstChild(id)
		assert(mod, "BuildingBuilder: no Data/Buildings module for " .. tostring(id))
		cache[id] = require(mod)
	end
	return cache[id]
end

local function shown(mask, level)
	return bit32.btest(mask, bit32.lshift(1, level - 1))
end

local function prefix(tex)
	return tex and string.match(tex, "^[a-z]+")
end

local function asset(group, key)
	local a = cfg.assets[group] and cfg.assets[group][key]
	return a and a.assetId ~= "" and a.assetId or nil
end

-- The size of one face (along the texture's U and V).
local function faceSize(size, face)
	if face == Enum.NormalId.Top or face == Enum.NormalId.Bottom then
		return size.X, size.Z
	elseif face == Enum.NormalId.Right or face == Enum.NormalId.Left then
		return size.Z, size.Y
	end
	return size.X, size.Y
end

-- Lays a material's texture or sign on one face of a part.
local function dress(p, mat, face)
	if mat.sign then
		local gui = Instance.new("SurfaceGui")
		gui.Face = face
		gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
		gui.PixelsPerStud = 40
		gui.LightInfluence = 1
		local label = Instance.new("TextLabel")
		label.Size = UDim2.fromScale(1, 1)
		label.BackgroundColor3 = Color3.fromHex(mat.colors[1])
		label.TextColor3 = Color3.fromHex(mat.colors[2])
		label.Text = mat.sign
		label.TextScaled = true
		label.FontFace = Font.fromEnum(Enum.Font.GothamBlack)
		label.Parent = gui
		gui.Parent = p
		return
	end
	local id = mat.tex and asset("Images", mat.tex)
	if not id then
		return
	end
	local t = Instance.new("Texture")
	t.Texture = "rbxassetid://" .. id
	t.Face = face
	t.Color3 = Color3.fromHex(mat.color)
	local u, v = faceSize(p.Size, face)
	local rep = mat.rep or { 1, 1 }
	t.StudsPerTileU = u / math.max(rep[1], 0.01)
	t.StudsPerTileV = v / math.max(rep[2], 0.01)
	t.Transparency = p.Transparency
	t.Parent = p
end

local function paint(p, mat)
	-- shade: the colour times its texture's average, so it reads right with or without the image.
	p.Color = Color3.fromHex(mat.sign and mat.colors[1] or mat.shade or mat.color)
	p.Material = MATERIAL[prefix(mat.tex) or ""] or (mat.metal and Enum.Material.Metal) or Enum.Material.SmoothPlastic
	if mat.alpha then
		p.Transparency = 1 - mat.alpha
	end
	if p.Material == Enum.Material.Glass and not mat.alpha then
		p.Material = Enum.Material.SmoothPlastic
		p.Reflectance = 0.15
	end
	if mat.glow then
		p:SetAttribute("Glow", mat.glow)
	end
end

-- One part from a row of Data/Buildings: {shape, mat, rot, x, y, z, sx, sy, sz, levels, faces?}.
local function makePart(data, row, k)
	local shape = row[1]
	local r = data.rots[row[3]]
	local cf = CFrame.new(row[4] * k, row[5] * k, row[6] * k, r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9])
	local size = Vector3.new(row[7], row[8], row[9]) * k
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.CastShadow = math.min(row[7], row[8], row[9]) > THIN and size.Magnitude > 1.5
	if shape == "B" then
		p.Size = size
	elseif shape == "S" then
		local even = math.abs(size.X - size.Y) < 0.05 * size.X and math.abs(size.X - size.Z) < 0.05 * size.X
		if even then
			p.Shape = Enum.PartType.Ball
		else
			Instance.new("SpecialMesh", p).MeshType = Enum.MeshType.Sphere
		end
		p.Size = size
	elseif shape == "C" then
		-- Roblox cylinders run along X: turn X onto the web's Y.
		p.Shape = Enum.PartType.Cylinder
		local d = (size.X + size.Z) / 2
		p.Size = Vector3.new(size.Y, d, d)
		cf = cf * CFrame.Angles(0, 0, math.pi / 2)
	elseif shape == "D" then
		p.Shape = Enum.PartType.Cylinder
		local d = (size.X + size.Y) / 2
		p.Size = Vector3.new(size.Z, d, d)
		cf = cf * CFrame.Angles(0, math.pi / 2, 0)
	else
		p.Size = size
		local id = asset("Meshes", shape)
		if id then
			local m = Instance.new("SpecialMesh")
			m.MeshType = Enum.MeshType.FileMesh
			m.MeshId = "rbxassetid://" .. id
			-- The meshes are exported in a 1x1x1 box, so the scale is the size in studs.
			m.Scale = size
			-- A textured mesh carries its image (its UVs already hold the tiling), tinted by its colour.
			local mat = data.mats[row[2]]
			local img = mat.tex and asset("Images", mat.tex)
			if img then
				m.TextureId = "rbxassetid://" .. img
				local c = Color3.fromHex(mat.color)
				m.VertexColor = Vector3.new(c.R, c.G, c.B)
			end
			m.Parent = p
		end
	end
	p.CFrame = cf
	local mat = data.mats[row[2]]
	paint(p, mat)
	local faces = row[11]
	if faces then
		for i, fi in faces do
			local fm = data.mats[fi]
			if fm.sign or fm.tex then
				dress(p, fm, NAMES[i])
			end
		end
	elseif mat.sign or mat.tex then
		if shape == "B" and row[9] <= THIN then
			dress(p, mat, Enum.NormalId.Back) -- a flat piece faces the web's +Z
		elseif shape == "B" then
			for i = 1, 5 do
				if NAMES[i] ~= Enum.NormalId.Bottom then
					dress(p, mat, NAMES[i])
				end
			end
			dress(p, mat, Enum.NormalId.Front)
		end
	end
	return p, cf
end

local function hitbox(model)
	local box = model:FindFirstChild("Hitbox")
	if not box then
		box = Instance.new("Part")
		box.Name = "Hitbox"
		box.Anchored = true
		box.Transparency = 1
		box.CanCollide = true
		box.CastShadow = false
		box.Parent = model
	end
	box:SetAttribute("Skip", true)
	local parts = model:FindFirstChild("Parts")
	local lo, hi = Vector3.new(math.huge, math.huge, math.huge), -Vector3.new(math.huge, math.huge, math.huge)
	local pivot = model:GetPivot()
	for _, p in parts:GetChildren() do
		local c = pivot:PointToObjectSpace(p.Position)
		local e = p.Size / 2
		lo = lo:Min(c - e)
		hi = hi:Max(c + e)
	end
	if lo.X == math.huge then
		return
	end
	box.Size = hi - lo
	box.CFrame = pivot * CFrame.new((lo + hi) / 2)
end

-- Builds building `id` at `level`. `cframe` places the middle of its lot.
function Builder.build(id, level, cframe, opts)
	opts = opts or {}
	local data = Builder.data(id)
	level = math.clamp(level, 1, data.maxLevel)
	local k = Builder.studsPerUnit * (opts.scale or 1)
	local model = Instance.new("Model")
	model.Name = data.name
	model:SetAttribute("BuildingId", id)
	model:SetAttribute("Level", level)
	model:SetAttribute("Scale", opts.scale or 1)
	local folder = Instance.new("Folder")
	folder.Name = "Parts"
	folder.Parent = model
	local base = cframe or CFrame.new()
	model.WorldPivot = base
	for i, row in data.parts do
		if shown(row[10], level) then
			local p, cf = makePart(data, row, k)
			p.CFrame = base * cf
			p.Name = tostring(i)
			p.Parent = folder
		end
	end
	hitbox(model)
	return model
end

-- Moves an existing model to `level`: parts the new level doesn't have go, the new ones
-- pop in (rise from a little below and fade in, staggered), and the rest stay.
function Builder.setLevel(model, level, opts)
	opts = opts or {}
	local data = Builder.data(model:GetAttribute("BuildingId"))
	level = math.clamp(level, 1, data.maxLevel)
	local k = Builder.studsPerUnit * (model:GetAttribute("Scale") or 1)
	local folder = model:FindFirstChild("Parts")
	local base = model:GetPivot()
	local fresh = {}
	for i, row in data.parts do
		local name = tostring(i)
		local have = folder:FindFirstChild(name)
		local want = shown(row[10], level)
		if have and not want then
			have:Destroy()
		elseif want and not have then
			local p, cf = makePart(data, row, k)
			p.CFrame = base * cf
			p.Name = name
			table.insert(fresh, p)
		end
	end
	model:SetAttribute("Level", level)
	local animate = opts.animate ~= false and #fresh <= 400
	for n, p in fresh do
		if animate then
			local goal = { CFrame = p.CFrame, Transparency = p.Transparency }
			p.CFrame = p.CFrame - Vector3.new(0, 0.6, 0)
			p.Transparency = 1
			p.Parent = folder
			local info = TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out, 0, false, math.min(n, 60) * 0.008)
			TweenService:Create(p, info, goal):Play()
		else
			p.Parent = folder
		end
	end
	hitbox(model)
	return #fresh
end

-- Night: parts the web game lights after dark (windows, signs, lamps) glow.
function Builder.setNight(model, night)
	for _, p in model:FindFirstChild("Parts"):GetChildren() do
		local glow = p:GetAttribute("Glow")
		if glow then
			if night then
				p:SetAttribute("DayColor", p:GetAttribute("DayColor") or p.Color:ToHex())
				p:SetAttribute("DayMaterial", p:GetAttribute("DayMaterial") or p.Material.Name)
				p.Color = Color3.fromHex(glow)
				p.Material = Enum.Material.Neon
			elseif p:GetAttribute("DayColor") then
				p.Color = Color3.fromHex(p:GetAttribute("DayColor"))
				p.Material = Enum.Material[p:GetAttribute("DayMaterial")]
			end
		end
	end
end

-- How many parts a building has at a level (for a budget check before placing).
function Builder.count(id, level)
	local n = 0
	for _, row in Builder.data(id).parts do
		if shown(row[10], level) then
			n += 1
		end
	end
	return n
end

return Builder

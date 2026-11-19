-- check.mjs appends this after the stand-ins, BuildingBuilder and the data: builds each
-- building at each level and prints its parts as JSON, then walks it up level by level.
require = function(m) return m.fn() end
local folder = { FindFirstChild = function(_, n) return mods[n] end }
Builder.init({ buildings = folder, assets = assets })
local function num(x) return string.format("%.4f", x) end
local function enc(p)
	local mesh = p:FindFirstChild("SpecialMesh")
	local r = {}
	for i = 1, 9 do r[i] = num(p.CFrame.r[i]) end
	local out = string.format('{"shape":"%s","p":[%s,%s,%s],"r":[%s],"size":[%s,%s,%s],"color":"%s","mat":"%s","alpha":%s',
		p.Shape and p.Shape.Name or "Block", num(p.CFrame.p.X), num(p.CFrame.p.Y), num(p.CFrame.p.Z), table.concat(r, ","),
		num(p.Size.X), num(p.Size.Y), num(p.Size.Z), p.Color.hex, p.Material.Name, num(p.Transparency))
	if mesh then
		out ..= string.format(',"mesh":"%s","meshId":"%s"', mesh.MeshType.Name, (string.gsub(mesh.MeshId or "", "rbxassetid://", "")))
		if mesh.TextureId then
			out ..= string.format(',"meshTex":"%s","tint":[%s,%s,%s]', (string.gsub(mesh.TextureId, "rbxassetid://", "")), num(mesh.VertexColor.X), num(mesh.VertexColor.Y), num(mesh.VertexColor.Z))
		end
	end
	local tex, gui = {}, {}
	for _, c in p:GetChildren() do
		if c.ClassName == "Texture" then
			table.insert(tex, string.format('{"face":"%s","img":"%s","u":%s,"v":%s,"color":"%s"}', c.Face.Name, (string.gsub(c.Texture, "rbxassetid://", "")), num(c.StudsPerTileU), num(c.StudsPerTileV), c.Color3.hex))
		elseif c.ClassName == "SurfaceGui" then
			local l = c:FindFirstChild("TextLabel")
			table.insert(gui, string.format('{"face":"%s","text":"%s","bg":"%s","fg":"%s"}', c.Face.Name, (string.gsub(l.Text, '["\\]', "\\%0")), l.BackgroundColor3.hex, l.TextColor3.hex))
		end
	end
	return out .. ',"tex":[' .. table.concat(tex, ",") .. '],"gui":[' .. table.concat(gui, ",") .. "]}"
end
for id in mods do
	for _, lv in { LEVELS } do
		if lv <= Builder.data(id).maxLevel then
			local m = Builder.build(id, lv, CFrame.new())
			local rows = {}
			for _, p in m:FindFirstChild("Parts"):GetChildren() do table.insert(rows, enc(p)) end
			print(string.format('{"id":"%s","level":%d,"k":%s,"count":%d,"parts":[%s]}', id, lv, num(Builder.studsPerUnit), Builder.count(id, lv), table.concat(rows, ",")))
		end
	end
	-- Level by level from 1, the way a player upgrades: must end with exactly the top level's parts.
	local m = Builder.build(id, 1, CFrame.new(10, 0, 5))
	local top = Builder.data(id).maxLevel
	for lv = 2, top do Builder.setLevel(m, lv) end
	Builder.setNight(m, true)
	Builder.setNight(m, false)
	local n, want = #m:FindFirstChild("Parts"):GetChildren(), Builder.count(id, top)
	assert(n == want, id .. ": " .. n .. " parts after levelling up, expected " .. want)
	print("#" .. id .. ": levels 1-" .. top .. " ok, " .. want .. " parts at the top")
end

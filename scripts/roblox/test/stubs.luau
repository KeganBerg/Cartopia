-- Roblox stand-ins with real CFrame and Vector3 maths, to run BuildingBuilder outside Studio.
local V = {}
V.__index = V
local function v3(x, y, z) return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, V) end
V.__add = function(a, b) return v3(a.X + b.X, a.Y + b.Y, a.Z + b.Z) end
V.__sub = function(a, b) return v3(a.X - b.X, a.Y - b.Y, a.Z - b.Z) end
V.__unm = function(a) return v3(-a.X, -a.Y, -a.Z) end
V.__mul = function(a, b) if type(a) == "number" then a, b = b, a end if type(b) == "number" then return v3(a.X * b, a.Y * b, a.Z * b) end return v3(a.X * b.X, a.Y * b.Y, a.Z * b.Z) end
V.__div = function(a, b) if type(b) == "number" then return v3(a.X / b, a.Y / b, a.Z / b) end return v3(a.X / b.X, a.Y / b.Y, a.Z / b.Z) end
V.__index = function(t, k)
	if k == "Magnitude" then return math.sqrt(t.X * t.X + t.Y * t.Y + t.Z * t.Z) end
	return V[k]
end
function V.Min(a, b) return v3(math.min(a.X, b.X), math.min(a.Y, b.Y), math.min(a.Z, b.Z)) end
function V.Max(a, b) return v3(math.max(a.X, b.X), math.max(a.Y, b.Y), math.max(a.Z, b.Z)) end
Vector3 = { new = v3 }

local C = {}
C.__index = C
local function cf(x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22)
	if type(x) == "table" then x, y, z = x.X, x.Y, x.Z end
	return setmetatable({ p = v3(x or 0, y or 0, z or 0), r = { r00 or 1, r01 or 0, r02 or 0, r10 or 0, r11 or 1, r12 or 0, r20 or 0, r21 or 0, r22 or 1 } }, C)
end
local function rotv(r, v) return v3(r[1] * v.X + r[2] * v.Y + r[3] * v.Z, r[4] * v.X + r[5] * v.Y + r[6] * v.Z, r[7] * v.X + r[8] * v.Y + r[9] * v.Z) end
C.__mul = function(a, b)
	if getmetatable(b) == V then return a.p + rotv(a.r, b) end
	local r = {}
	for i = 0, 2 do for j = 0, 2 do
		local s = 0
		for k = 0, 2 do s += a.r[i * 3 + k + 1] * b.r[k * 3 + j + 1] end
		r[i * 3 + j + 1] = s
	end end
	local p = a.p + rotv(a.r, b.p)
	return cf(p.X, p.Y, p.Z, table.unpack(r))
end
C.__add = function(a, v) return cf(a.p.X + v.X, a.p.Y + v.Y, a.p.Z + v.Z, table.unpack(a.r)) end
C.__sub = function(a, v) return cf(a.p.X - v.X, a.p.Y - v.Y, a.p.Z - v.Z, table.unpack(a.r)) end
C.__index = function(t, k) if k == "Position" then return t.p end return C[k] end
function C.PointToObjectSpace(a, v)
	local d = v - a.p
	local r = a.r
	return v3(r[1] * d.X + r[4] * d.Y + r[7] * d.Z, r[2] * d.X + r[5] * d.Y + r[8] * d.Z, r[3] * d.X + r[6] * d.Y + r[9] * d.Z)
end
CFrame = { new = cf }
function CFrame.Angles(x, y, z)
	local cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
	local X = cf(0, 0, 0, 1, 0, 0, 0, cx, -sx, 0, sx, cx)
	local Y = cf(0, 0, 0, cy, 0, sy, 0, 1, 0, -sy, 0, cy)
	local Z = cf(0, 0, 0, cz, -sz, 0, sz, cz, 0, 0, 0, 1)
	return X * Y * Z
end
Color3 = { fromHex = function(h) return { hex = h, R = tonumber(string.sub(h, 2, 3), 16) / 255, G = tonumber(string.sub(h, 4, 5), 16) / 255, B = tonumber(string.sub(h, 6, 7), 16) / 255, ToHex = function(s) return s.hex end } end }
UDim2 = { fromScale = function(a, b) return { a, b } end }
Font = { fromEnum = function(e) return e end }
TweenInfo = { new = function(...) return { ... } end }
Enum = setmetatable({}, { __index = function(_, k) return setmetatable({}, { __index = function(_, v) return { Name = v, Kind = k } end }) end })
-- Enum values must compare equal across lookups.
local enumCache = {}
Enum = setmetatable({}, { __index = function(_, k)
	enumCache[k] = enumCache[k] or setmetatable({}, { __index = function(t, v) local e = { Name = v, Kind = k } rawset(t, v, e) return e end })
	return enumCache[k]
end })
local all = {}
local function inst(class)
	local o = { ClassName = class, Name = class, attrs = {}, kids = {}, Transparency = 0 }
	function o:SetAttribute(k, v) self.attrs[k] = v end
	function o:GetAttribute(k) return self.attrs[k] end
	function o:FindFirstChild(n) for _, c in self.kids do if c.Name == n then return c end end return nil end
	function o:GetChildren() local r = {} for _, c in self.kids do table.insert(r, c) end return r end
	function o:Destroy() if self.Parent then table.remove(self.Parent.kids, table.find(self.Parent.kids, self)) end rawset(self, "Parent", nil) end
	function o:GetPivot() return self.WorldPivot end
	return setmetatable(o, { __index = function(t, k) if k == "Position" then return rawget(t, "CFrame").p end return nil end, __newindex = function(t, k, v)
		if k == "Parent" then if v then table.insert(v.kids, t) end end
		rawset(t, k, v)
	end })
end
Instance = { new = function(c, parent) local o = inst(c) if parent then o.Parent = parent end return o end }
tweens = 0
game = { GetService = function(_, n) return { Create = function(_, obj, _, goal) tweens += 1 return { Play = function() for k, v in goal do obj[k] = v end end } end } end }

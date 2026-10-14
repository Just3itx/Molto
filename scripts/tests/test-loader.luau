-- Run after a build: lune run scripts/tests/test-loader.luau
local fs = require("@lune/fs")
local luau = require("@lune/luau")
local serde = require("@lune/serde")

local source = fs.readFile("site/source.lua")
local assetBase = assert(source:match('local ASSET_BASE_URL = "([^"]+)"'))
local manifest = serde.decode("json", fs.readFile("site/providers/manifest.json"))
local provider = assert(source:match('local DEFAULT_PROVIDER = "([^"]+)"'))
local meta = assert(manifest[provider])

local function localPath(url: string): string
	assert(url:sub(1, #assetBase) == assetBase, `Unexpected download: {url}`)
	return "site/" .. url:sub(#assetBase + 1)
end

local function run(withFiles: boolean, badFont: boolean?)
	local base = { Vector2 = { new = function(x, y) return { x, y } end } }
	local face = {}
	local files, folders = {}, { ["molto-icons"] = true }
	local environment = table.clone(base)
	environment.task = task
	environment.loadstring = function(code) return luau.load(code, { environment = environment }) end
	environment.Font = { new = function() return face end }
	environment.game = {
		HttpGet = function(_, url)
			if badFont and url:match("%.ttf$") then return "<html>404</html>" end
			return fs.readFile(localPath(url))
		end,
		GetService = function() return { JSONEncode = function(_, value) return serde.encode("json", value) end } end,
	}
	if withFiles then
		environment.isfile = function(name) return files[name] ~= nil end
		environment.isfolder = function(name) return folders[name] == true end
		environment.makefolder = function(name) folders[name] = true end
		environment.readfile = function(name) return assert(files[name]) end
		environment.writefile = function(name, contents) files[name] = contents end
		environment.listfiles = function()
			local entries = {}
			for name in folders do
				if name ~= "molto-icons" then table.insert(entries, (name:gsub("/", "\\"))) end
			end
			return entries
		end
		environment.delfolder = function(name)
			folders[name] = nil
		end
		environment.getcustomasset = function(name) return "custom://" .. name end

		-- stale build of the same provider must be pruned, other providers kept
		folders[`molto-icons/{provider}-{string.rep("1", 64)}`] = true
		folders[`molto-icons/other-{string.rep("2", 64)}`] = true
	end

	local registry = luau.load(source, { environment = environment })()
	assert(registry.GetProvider() == provider)
	assert(registry.GetAsset("not-an-icon") == nil)
	assert(registry.GetFontAsset == nil, "GetFontAsset must not exist")

	local name = assert(manifest[provider] and registry.GetIcons()[1])
	local asset = assert(registry.GetAsset(name))
	assert(asset.Url and asset.ImageRectSize and asset.ImageRectOffset and asset.Provider == provider)

	if withFiles and meta.Font and not badFont then
		assert(asset.FontFace == face and asset.Text == name, "Font fields present")
		assert(asset.Url:find("custom://molto-icons/", 1, true) == 1, "Custom sprites used: " .. tostring(asset.Url))
		assert(not folders[`molto-icons/{provider}-{string.rep("1", 64)}`], "Stale build pruned")
		assert(folders[`molto-icons/other-{string.rep("2", 64)}`], "Other provider kept")
	else
		assert(asset.FontFace == nil and asset.Text == nil, "No font fields without a font")
		assert(asset.Url:find("rbxassetid://", 1, true) == 1 or withFiles, "Fallback sprites used")
	end

	for _, id in registry.Providers do
		registry.SetProvider(id)
		assert(registry.GetProvider() == id)

		-- every icon resolves to a rect that fits inside a sheet, and every alias resolves
		local icons = registry.GetIcons()
		assert(#icons == manifest[id].Count, `Icon count mismatch: {id}`)
		for _, icon in icons do
			local info = assert(registry.GetAsset(icon), `Missing icon: {id}/{icon}`)
			assert(info.ImageRectSize[1] > 0 and info.ImageRectOffset[1] + info.ImageRectSize[1] <= 1024, `Bad rect: {id}/{icon}`)
			assert(info.ImageRectOffset[2] + info.ImageRectSize[2] <= 1024, `Bad rect: {id}/{icon}`)
			assert((info.FontFace ~= nil) == (withFiles and manifest[id].Font and not badFont), `Font mismatch: {id}/{icon}`)

			-- the font part the loader picks must be the one the build put this icon in
			if withFiles and manifest[id].Font and not badFont then
				local file = `site/fonts/{id}/{id}-{info.FontPart}.codepoints.json`
				if fs.isFile(file) then
					local glyphs = serde.decode("json", fs.readFile(file)).icons
					assert(glyphs[icon], `Icon {id}/{icon} is not in font part {info.FontPart}`)
				end
			end
		end
	end
	-- PreloadAsync fetches only the parts the names need, or all of them without names
	local preloaded = registry.PreloadAsync({ name, "not-an-icon" }, provider)
	if withFiles and meta.Font and not badFont then
		assert(preloaded == 1, "Preload of one icon readies one part")
		assert(registry.PreloadAsync(nil, provider) == meta.FontParts, "Preload of everything readies every part")
	else
		assert(preloaded == 0, "Preload without a usable font readies nothing")
	end
	if withFiles and not badFont and manifest.fluent and manifest.fluent.Font then
		assert(registry.PreloadAsync(nil, "fluent") == manifest.fluent.FontParts, "Parallel preload readies every part")
	end
	assert(not pcall(registry.SetProvider, "nope"))
end

run(false)
run(true)
run(true, true)
print("Loader: provider switching, caching, pruning, and font fallback passed")

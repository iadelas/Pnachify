param(
    [string]$EmsdkRoot = "C:\emsdk"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$emsdkEnv = Join-Path $EmsdkRoot "emsdk_env.ps1"
if (-not (Test-Path $emsdkEnv)) {
    throw "emsdk not found at $EmsdkRoot. Install it with: git clone https://github.com/emscripten-core/emsdk.git $EmsdkRoot"
}

. $emsdkEnv

$vsRoot = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake"
$ninja = Join-Path $vsRoot "Ninja\ninja.exe"
$env:PATH = "$(Join-Path $vsRoot 'CMake\bin');$(Join-Path $vsRoot 'Ninja');$env:PATH"
$buildDir = Join-Path $repo ".temp\wasm-build"
$generatedDir = Join-Path $repo "web\src\lib\generated"
$publicDir = Join-Path $repo "web\public"

New-Item -ItemType Directory -Force $buildDir, $generatedDir, $publicDir | Out-Null

$identity = @{}
Select-String -Path (Join-Path $repo "core\cmake\OmniIdentity.cmake") -Pattern 'set\((OMNI_\w+) "([^"]*)"\)' |
    ForEach-Object { $identity[$_.Matches[0].Groups[1].Value] = $_.Matches[0].Groups[2].Value }

$template = Get-Content (Join-Path $repo "core\cmake\templates\identity.hpp.in") -Raw
foreach ($key in $identity.Keys) {
    $template = $template.Replace("@$key@", $identity[$key])
}
$generatedInclude = Join-Path $buildDir "include\omni"
New-Item -ItemType Directory -Force $generatedInclude | Out-Null
Set-Content -Path (Join-Path $generatedInclude "identity.hpp") -Value $template -NoNewline

emcmake cmake -S (Join-Path $repo "core") -B $buildDir -G Ninja `
    -DCMAKE_BUILD_TYPE=Release `
    -DCMAKE_CXX_FLAGS=-fexceptions `
    -DOMNI_REQUIRE_64_BIT=OFF `
    -DOMNI_BUILD_GUI=OFF -DOMNI_BUILD_CLI=OFF -DOMNI_BUILD_TESTS=OFF
if ($LASTEXITCODE -ne 0) { throw "core configure failed" }

cmake --build $buildDir --target omni_core
if ($LASTEXITCODE -ne 0) { throw "core build failed" }

em++ -std=c++17 -O2 -fexceptions `
    "-sMODULARIZE=1" "-sEXPORT_ES6=1" "-sEXPORT_NAME=createOmniModule" `
    "-sENVIRONMENT=web,node" "-sALLOW_MEMORY_GROWTH=1" "-sASSERTIONS=0" `
    "-sEXPORTED_FUNCTIONS=_omni_convert,_omni_free,_omni_last_error,_malloc,_free" `
    "-sEXPORTED_RUNTIME_METHODS=ccall,UTF8ToString,stringToUTF8" `
    -I (Join-Path $repo "core\src") -I (Join-Path $buildDir "include") `
    (Join-Path $repo "wasm\omni_wasm.cpp") `
    (Join-Path $buildDir "libomni_core.a") `
    -o (Join-Path $generatedDir "omni.mjs")
if ($LASTEXITCODE -ne 0) { throw "wasm link failed" }

Move-Item -Force (Join-Path $generatedDir "omni.wasm") (Join-Path $publicDir "omni.wasm")
Write-Host "Built web\public\omni.wasm and web\src\lib\generated\omni.mjs"

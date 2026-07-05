Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
New-Item -ItemType Directory -Force (Join-Path $root "sprites") | Out-Null
$table = @"
c18 tpe101 0.06 0.08 0.28 0.44
c14 jiufen 0.52 0.58 0.38 0.36
c14 yehliu 0.74 0.10 0.24 0.28
c14 yingge 0.03 0.20 0.28 0.28
c14 sanxia 0.08 0.56 0.32 0.34
c14 tamsui 0.44 0.20 0.30 0.24
c03 miaokou 0.03 0.13 0.30 0.32
c03 keelungport 0.42 0.22 0.40 0.22
c05 daxi 0.03 0.55 0.32 0.35
c05 lalashan 0.55 0.65 0.40 0.33
c22 leofoo 0.03 0.10 0.32 0.30
c22 neiwan 0.38 0.16 0.30 0.24
c22 beipu 0.08 0.53 0.32 0.32
c06 shengxing 0.10 0.20 0.34 0.26
c10 gaomei 0.03 0.18 0.28 0.28
c10 dajia 0.40 0.12 0.32 0.30
c10 opera 0.16 0.44 0.32 0.26
c10 gongyuan 0.58 0.45 0.30 0.27
c10 rainbow 0.36 0.66 0.34 0.30
c13 lukang 0.08 0.12 0.32 0.30
c13 buddha 0.52 0.10 0.30 0.32
c13 wanggong 0.08 0.50 0.30 0.32
c04 sunmoon 0.52 0.16 0.38 0.32
c04 nine 0.62 0.58 0.36 0.36
c04 xitou 0.03 0.58 0.32 0.34
c04 hehuan 0.33 0.50 0.32 0.36
c09 beigang 0.08 0.12 0.32 0.30
c09 douliu 0.52 0.13 0.38 0.28
c01 fenqihu 0.60 0.18 0.36 0.22
c01 southpalace 0.28 0.36 0.36 0.24
c01 highheel 0.58 0.58 0.37 0.35
c01 dongshi 0.03 0.58 0.32 0.35
c08 hinoki 0.05 0.16 0.32 0.28
c08 wenhua 0.52 0.16 0.35 0.28
c21 chikan 0.05 0.04 0.30 0.32
c21 anping 0.33 0.26 0.32 0.32
c21 garden 0.55 0.56 0.42 0.35
c20 pier2 0.03 0.06 0.32 0.30
c20 dragon 0.64 0.03 0.34 0.32
c20 t85 0.36 0.24 0.32 0.32
c20 cijin 0.40 0.70 0.32 0.28
c15 hengchun 0.35 0.38 0.32 0.30
c15 aquarium 0.10 0.58 0.32 0.32
c15 liuqiu 0.03 0.12 0.27 0.36
c16 jiaoxi 0.08 0.70 0.32 0.29
c16 chuanyi 0.50 0.18 0.38 0.30
c16 lanyang 0.60 0.46 0.34 0.32
c16 taiping 0.08 0.18 0.30 0.30
c11 taroko 0.03 0.06 0.30 0.34
c11 qingshui 0.58 0.06 0.38 0.32
c11 qixingtan 0.30 0.38 0.38 0.27
c17 sanxiantai 0.60 0.20 0.38 0.26
c17 balloonhi 0.06 0.04 0.26 0.36
c17 zhiben 0.60 0.58 0.36 0.35
c12 penghumatsu 0.06 0.52 0.30 0.32
c12 xbridge 0.03 0.10 0.32 0.28
c12 heartweir 0.33 0.38 0.28 0.26
c12 jibei 0.65 0.08 0.33 0.34
c02 juguang 0.08 0.08 0.30 0.38
c02 shanhou 0.56 0.12 0.38 0.30
c19 qinbi 0.50 0.10 0.38 0.30
"@
foreach($line in ($table -split "`n")) {
  $line = $line.Trim(); if(-not $line){continue}
  $p = $line -split "\s+"
  $src = Join-Path $root ("ref\" + $p[0] + ".png")
  $img = [System.Drawing.Image]::FromFile($src)
  $x=[int]([double]$p[2]*$img.Width); $y=[int]([double]$p[3]*$img.Height)
  $w=[int]([double]$p[4]*$img.Width); $h=[int]([double]$p[5]*$img.Height)
  $bmp = New-Object System.Drawing.Bitmap($w,$h)
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $dst = New-Object System.Drawing.Rectangle(0,0,$w,$h)
  $srcR = New-Object System.Drawing.Rectangle($x,$y,$w,$h)
  $gfx.DrawImage($img,$dst,$srcR,[System.Drawing.GraphicsUnit]::Pixel)
  $out = Join-Path $root ("sprites\" + $p[1] + ".png")
  $bmp.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)
  $gfx.Dispose(); $bmp.Dispose(); $img.Dispose()
}
Write-Output ("done " + (Get-ChildItem (Join-Path $root "sprites")).Count + " sprites")

---
title: "Powershell Config"
date: 2024-04-21T11:26:19+08:00
draft: false
tags: ["Shell","Termainl"]
---

<!--more-->

# Download

First,you need to download `Powershell7` to replace Windows PowerShell5.1,Powershell7 has been designed specially for cloud,local and mix environment.For example,it provides based SSH remote processing,Docker containers,cross platform etc.

Recommend three main ways to acquire it:

- Install Powershell7 by using Winget

  running the command to seach available versions
  
  ```powershell
  winget search Microsoft.PowerShell
  ```
  
  it will output
  
  ```
  Name               Id                           Version   Source
  -----------------------------------------------------------------
  PowerShell         Microsoft.PowerShell         7.4.2.0   winget
  PowerShell Preview Microsoft.PowerShell.Preview 7.5.0.2   winget
  ```
  
  you can use `id` to choose
  
  ```powershell
  winget install --id Microsoft.Powershell --source winget
  winget install --id Microsoft.Powershell.Preview --source winget
  ```
  
- Install Powershell7 by releases on Github

  [Click](https://github.com/PowerShell/powershell/releases) and choose the latest to install,it provides MSI  and ZIP.

  <img src="https://tuchuang-1312256370.cos.ap-shanghai.myqcloud.com/image-20240421184336361.png" alt="image-20240421184336361" style="zoom:80%;" />

# Beautify

Now we install Poweshell7 successfully,but for a patient with OCD, beautifying it is necessary.

Achieving it we need to install a package [Home | Oh My Posh](https://ohmyposh.dev/),it provide some themes which are selected and makes your interface more colorful.

1.Open your Powershell and run this cmd

```powershell
winget install JanDeDobbeleer.OhMyPosh -s winget
```

2.Run another amd to config environment variables

```powershell
$env:Path += ";C:\Users\user\AppData\Local\Programs\oh-my-posh\bin"
```

path is location of on-my-posh.if your username is Chinese,it will be garbled and the environment variables will be invalid,so I advise you move it to another location and config location variables.

<img src="https://tuchuang-1312256370.cos.ap-shanghai.myqcloud.com/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20240421203821.png" alt="微信图片_20240421203821" style="zoom: 67%;" />

3.on-my-posh is compatible nerd font

open this link [Nerd Fonts - Iconic font aggregator, glyphs/icons collection, & fonts patcher](https://www.nerdfonts.com/) select one satisfying yourself and download it.After downloaded it ,click and run it to install on your PC.

4.open your terminal, setting.json,find the following code.Insert front name your select.

```json
{
    "profiles":
    {
        "defaults":
        {
            "font":
            {
                "face": "MesloLGM Nerd Font"
            }
        }
    }
}
```

5.config your termnal

1)input this cmd to open the config file

```powershell
notepad $PROFILE
```

2)paste this code to the nodepad

```powershell
oh-my-posh init pwsh --config "$env:POSH_THEMES_PATH\jandedobbeleer.omp.json" | Invoke-Expression 
```

3)run this code to list themes 

```powershell
Get-PoshThemes
```

4)choose what you like and replace`jandedobbeleer`,like me

```
oh-my-posh init pwsh --config "$env:POSH_THEMES_PATH\atomic.omp.json" | Invoke-Expression 
```

6.install icons 

```powershell
Install-Module -Name Terminal-Icons -Repository PSGallery
```
import to profile
```
Import-Module -Name Terminal-Icons
```

Finally,restart your windows terminal and powershell.

![display](https://tuchuang-1312256370.cos.ap-shanghai.myqcloud.com/image-20240421210119245.png "product display")


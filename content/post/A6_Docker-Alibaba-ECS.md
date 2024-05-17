---
title: "Docker on Alibaba ECS"
date: 2024-05-16T21:46:35+08:00
draft: false
tags: ["Service"]
---

<div class="image-container" style="text-align: center;line-height: 0;">	
    <img src="https://tuchuang-1312256370.cos.ap-shanghai.myqcloud.com/docker-mark-blue.svg" alt="docker" width="130" height="auto" style="vertical-align: middle;"/>
</div>



<!--more-->

remote connect to `ECS` and install docker

1.add dnf of docker-ce source

```shell
sudo dnf config-manager --add-repo=https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
```

2.install Alibaba Cloud Linux3 plugin

```shell
sudo dnf -y install dnf-plugin-releasever-adapter --repo alinux3-plus
```

3.install docker

```shell
sudo dnf -y install docker-ce --nobest
```

4.check if it is installed

```shell
sudo docker -v
```

5.start docker and set it start when power-on

```shell
sudo systemctl start docker
sudo systemctl enable docker
```

6.check if it is started

```shell
sudo systemctl status docker
```

![](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9710116861/p679571.png)




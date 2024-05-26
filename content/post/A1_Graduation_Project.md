---
title: "Graduation| Latex OCR by Pytorch"
date: "2023-11-07"
tags: ["CS"]
---


<div class="image-container" style="text-align: center;line-height: 0;">
    <img src="https://upload.wikimedia.org/wikipedia/commons/9/92/LaTeX_logo.svg" alt="VS Code" width="100" height="auto" style="vertical-align: middle;"/>
    <scan> <i class="bi bi-plus-lg"></i> </scan>
    <img src="https://tuchuang-1312256370.cos.ap-shanghai.myqcloud.com/Icon_%E5%85%AC%E5%BC%8F%E5%AE%9A%E4%B9%89.svg" alt="VS Code" width="80" height="auto" style="vertical-align: middle;"/>
</div>
<!--more-->

reference link1:[xungirl/LaTeX-OCR: pix2tex: Using a ViT to convert images of equations into LaTeX code.](https://github.com/xungirl/LaTeX-OCR)

reference link2:[pix2tex](https://pix2tex.readthedocs.io/en/latest/installation.html#docker)

Tech-stack



### 详细步骤总结

1. 开发前端界面
   使用熟悉的前端框架（如 React、Vue.js）开发一个用户界面，允许用户上传图片，并通过 API 调用 `pix2tex` 进行图像识别。

2. 配置前端项目
   在前端项目中，配置调用 `pix2tex` API 的请求。需要将 API URL 指向你部署的 `pix2tex` 容器地址。

3. 使用 Docker 
   拉取并运行 `pix2tex` Docker 镜像，无需在本地安装相应的包。`pix2tex` Docker 镜像已经包含了运行所需的所有依赖。

4. 部署到云平台
   将前端应用和 `pix2tex` Docker 镜像部署到云平台，如 AWS、Google Cloud 或 Azure，使其可以通过公网访问。

### 示例详细步骤

#### 前端开发

使用 React 开发前端：

1. 创建前端项目

   ```bash
   npx create-react-app pix2tex-frontend
   cd pix2tex-frontend
   ```

2. 配置 API 调用
   编辑 `src/App.js`：

   ```jsx
   import React, { useState } from 'react';
   import axios from 'axios';
   
   function App() {
     const [image, setImage] = useState(null);
     const [result, setResult] = useState('');
   
     const handleImageChange = (e) => {
       setImage(e.target.files[0]);
     };
   
     const handleSubmit = async (e) => {
       e.preventDefault();
       const formData = new FormData();
       formData.append('file', image);
   
       try {
         const response = await axios.post('http://your-api-url:8502/recognize', formData, {
           headers: {
             'Content-Type': 'multipart/form-data',
           },
         });
         setResult(response.data.result);
       } catch (error) {
         console.error('Error recognizing image:', error);
       }
     };
   
     return (
       <div className="App">
         <h1>Pix2Tex Frontend</h1>
         <form onSubmit={handleSubmit}>
           <input type="file" onChange={handleImageChange} />
           <button type="submit">Recognize</button>
         </form>
         {result && <p>Result: {result}</p>}
       </div>
     );
   }
   
   export default App;
   ```

3. 创建 Dockerfile
   在前端项目根目录下创建一个名为 `Dockerfile` 的文件：

   ```Dockerfile
   FROM node:14
   
   WORKDIR /app
   
   COPY package*.json ./
   RUN npm install
   
   COPY . .
   
   RUN npm run build
   
   FROM nginx:alpine
   COPY --from=0 /app/build /usr/share/nginx/html
   
   EXPOSE 80
   
   CMD ["nginx", "-g", "daemon off;"]
   ```

4. 构建和运行前端 Docker 镜像

   ```bash
   docker build -t pix2tex-frontend .
   docker run -d -p 3000:80 pix2tex-frontend
   ```

#### 部署 `pix2tex` API

1. 将 Docker 镜像从 DockerHub 拉取到你的服务器上：

   ```
   docker pull lukasblecher/pix2tex:api
   ```

2. 运行 API 容器，将容器内的端口映射到服务器的端口：

   ```
   docker run -d -p 8502:8502 lukasblecher/pix2tex:api
   ```

   这将在后台运行容器，并将容器的 8502 端口映射到服务器的 8502 端口。

3. 如果你想运行 Streamlit demo，执行以下命令：

   ```
   docker run -d -p 8501:8501 --entrypoint python lukasblecher/pix2tex:api pix2tex/api/run.py
   ```

   这将在后台运行容器，并将容器的 8501 端口映射到服务器的 8501 端口。

现在，你的 Docker 项目已经在服务器上部署成功了。你可以通过浏览器访问相应的端口来使用 API 或者 Streamlit demo。例如，对于 API，访问 `http://服务器IP:8502`，对于 Streamlit demo，访问 `http://服务器IP:8501`。

以 AWS EC2 为例：

1. 创建并配置 EC2 实例

   - 登录 AWS 管理控制台，创建一个新的 EC2 实例，选择 Ubuntu 操作系统。
   - 使用 SSH 连接到 EC2 实例。

2. 安装 Docker

   ```bash
   sudo apt update
   sudo apt install docker.io
   sudo systemctl start docker
   sudo systemctl enable docker
   ```

3. 拉取并运行 Docker 容器

   - 运行前端应用：

     ```bash
     sudo docker run -d -p 80:80 pix2tex-frontend
     ```

   - 运行 `pix2tex` API：

     ```bash
     sudo docker run -d -p 8502:8502 lukasblecher/pix2tex:api
     ```

#### 配置域名（可选）

1. **注册并登录 Cloudflare**。
2. **添加站点**：输入域名。
3. **更新 DNS 记录**：
   - 添加 A 记录，将你的域名指向 EC2 实例的 IP 地址。
   - 为前端应用添加 CNAME 记录，指向 Vercel 或 Netlify 提供的域名。

### 


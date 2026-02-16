---
title: ""
layout: "single"
url: "/about/"
summary: "About me"
ShowToc: false
ShowBreadCrumbs: false
hidemeta: true
---

<style>
.about-wrapper { max-width: 680px; margin: -1rem auto 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-align: center; }

/* Avatar */
.about-avatar-wrap { margin-bottom: 24px; }
.about-avatar-wrap { margin-bottom: 24px; text-align: center; }
.about-avatar {
  width: 168px; height: 168px;
  border-radius: 50% !important;
  object-fit: cover;
  display: inline-block !important;
  margin: 0 auto !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}

/* Header */
.about-name { font-size: 2rem; font-weight: 700; margin: 0 0 8px; color: var(--primary, #222); }
.dark .about-name { color: #e8e8e8; }

.about-headline { font-size: 1.05rem; color: #666; margin: 0 0 6px; line-height: 1.6; }
.dark .about-headline { color: #aaa; }

.about-location { font-size: 0.9rem; color: #999; margin: 0 0 20px; }
.dark .about-location { color: #777; }

/* Buttons */
.about-links { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 8px; }
.about-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 22px; border-radius: 24px; font-size: 0.9rem;
  text-decoration: none; font-weight: 600; transition: all 0.2s;
}
.about-btn-primary { background: #0077B5; color: #fff; }
.about-btn-primary:hover { background: #005f8f; color: #fff; }
.about-btn-outline { border: 2px solid #0077B5; color: #0077B5; background: transparent; }
.about-btn-outline:hover { background: #0077B5; color: #fff; }

/* Divider */
.about-divider { border: none; border-top: 1px solid #eee; margin: 32px 0; }
.dark .about-divider { border-top-color: #333; }

/* Section */
.about-section { text-align: left; margin-bottom: 32px; }
.about-section h2 {
  font-size: 1.2rem; font-weight: 700; margin: 0 0 14px;
  color: #0077B5; text-transform: uppercase; letter-spacing: 1px;
}

.about-section p { line-height: 1.8; color: #444; margin: 0 0 12px; }
.dark .about-section p { color: #bbb; }

/* Skills */
.skills-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.skill-tag {
  padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 500;
  background: #e8f4fd; color: #0077B5; transition: transform 0.2s;
}
.skill-tag:hover { transform: translateY(-2px); }
.dark .skill-tag { background: #0d2137; color: #5bc0de; }

/* Projects */
.project-item {
  padding: 16px 20px; margin-bottom: 12px;
  border-radius: 10px; border: 1px solid #eee;
  transition: box-shadow 0.2s;
}
.project-item:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.dark .project-item { border-color: #333; }
.dark .project-item:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.3); }

.project-title { font-size: 1rem; font-weight: 600; margin: 0 0 6px; }
.project-title a { color: #0077B5; text-decoration: none; }
.project-title a:hover { text-decoration: underline; }

.project-desc { font-size: 0.9rem; color: #666; margin: 0 0 8px; line-height: 1.6; }
.dark .project-desc { color: #999; }

.project-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.project-tag {
  font-size: 0.75rem; padding: 3px 10px;
  border-radius: 12px; background: #f0f0f0; color: #666;
}
.dark .project-tag { background: #2a2a2a; color: #999; }

/* Responsive */
@media (max-width: 600px) {
  .about-avatar { width: 132px; height: 132px; }
  .about-name { font-size: 1.6rem; }
  .about-section { padding: 0 4px; }
}
</style>

<div class="about-wrapper">

  <!-- Avatar Centered -->
  <div class="about-avatar-wrap">
    <!-- Replace src with your photo OSS link -->
    <img class="about-avatar" src="https://photobed1.oss-us-west-1.aliyuncs.com/blog/IMG_0871.JPG" alt="Xun" />
  </div>

  <!-- Name & Headline -->
  <h1 class="about-name">Xun</h1>
  <p class="about-headline">CS Graduate Student @ Northeastern University</p>
  <p class="about-location">📍 Seattle, WA</p>

  <!-- Links -->
  <div class="about-links">
    <a class="about-btn about-btn-primary" href="https://github.com/xungirl" target="_blank">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.694.825.576C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/></svg>
      GitHub
    </a>
    <a class="about-btn about-btn-outline" href="mailto:your-email@example.com">
      ✉️ Contact
    </a>
  </div>

  <hr class="about-divider" />

  <!-- About -->
  <div class="about-section">
    <h2>About Me</h2>
    <p>Hey there! I'm Xun, a CS grad student at Northeastern University with a passion for building things that actually work.</p>
    <p>I love turning ideas into real products — whether it's a web app, a handy tool, or a piece of clean, well-tested code. When I'm not doing coursework, you'll find me exploring AI-assisted programming, grinding LeetCode, or tinkering with new tech.</p>
    <p>This blog is my digital garden 🌱 where I document what I learn, the bugs I squash, and the occasional random thought. Hope you find something useful here!</p>
  </div>

  <!-- Skills -->
  <div class="about-section">
    <h2>Tech Stack</h2>
    <div class="skills-grid">
      <span class="skill-tag">Java</span>
      <span class="skill-tag">Python</span>
      <span class="skill-tag">JavaScript</span>
      <span class="skill-tag">React</span>
      <span class="skill-tag">FastAPI</span>
      <span class="skill-tag">Hugo</span>
      <span class="skill-tag">Git</span>
      <span class="skill-tag">Gradle</span>
      <span class="skill-tag">HTML / CSS</span>
      <span class="skill-tag">JUnit</span>
    </div>
  </div>

  <!-- Projects -->
  <div class="about-section">
    <h2>Projects</h2>
    <div class="project-item">
      <p class="project-title"><a href="#">🐾 Goodle — Pet Matching Platform</a></p>
      <p class="project-desc">A full-stack app that helps you find your perfect furry companion. Supports filtering, smart matching, and more.</p>
      <div class="project-tags">
        <span class="project-tag">React</span>
        <span class="project-tag">FastAPI</span>
        <span class="project-tag">Python</span>
      </div>
    </div>
    <div class="project-item">
      <p class="project-title"><a href="#">🧩 Sudoku</a></p>
      <p class="project-desc">A lightweight online Sudoku game deployed on GitHub Pages. Perfect for killing time anywhere.</p>
      <div class="project-tags">
        <span class="project-tag">JavaScript</span>
        <span class="project-tag">HTML / CSS</span>
        <span class="project-tag">GitHub Pages</span>
      </div>
    </div>
    <div class="project-item">
      <p class="project-title"><a href="#">📝 xun's Blog</a></p>
      <p class="project-desc">The blog you're reading right now! Built with Hugo + PaperMod to share notes, tutorials, and tech adventures.</p>
      <div class="project-tags">
        <span class="project-tag">Hugo</span>
        <span class="project-tag">PaperMod</span>
        <span class="project-tag">GitHub Pages</span>
      </div>
    </div>
  </div>

</div>

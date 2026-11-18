# 共享资源目录

生产素材在 packages/client/src/assets/art-direction/v3.1，module/category在manifest中分类。由三个前端构建器打包，避免拷贝多份public目录。manifest的original/prompt_file/variants路径相对此生产目录；本目录prompts保存相同提示词供阅读。最终生成源文件保留在生产目录originals。

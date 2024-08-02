---
title: 与 Git 一起使用
---

Canarails 和核心目标之一是与类似 GitHub Actions 的 Git Pipeline 配合使用以实现自动化运维。

在这一章节，我们将实现一个简易的 GitOps，其主要目标有以下几点：

- master 分支更新时，自动部署新版本的内容至默认节点

- 当创建合并至 master 分支的 pull request 时，构建分支内容并部署到金丝雀节点

- 当合并至 master 的 pull request 更新时，构建分支内容并更新到金丝雀节点

- 当 pull request 关闭时，移除金丝雀节点以节省资源

## 创建授权令牌

介绍如何创建授权令牌。

## 使用 CURL 更新流量泳道

以 GitHub Actions 为例介绍如何使用 CURL 更新 Canarails AppVariant。

## 完成

以 Canarails Doc 为例，展示自动化拉起金丝雀环境的成果。

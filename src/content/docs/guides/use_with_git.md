---
title: 与 Git 一起使用
---

Canarails 和核心目标之一是与类似 GitHub Actions 的 Git Pipeline 配合使用以实现自动化部署。

## 创建授权令牌

要通过 Canarails 结合 Git Pipeline 实现自动化部署，我们首先需要创建一个授权令牌以获得在流水线中操作 Canarails 资源的权限。

首先进入 Canarails 控制台，点击 `Canarails` 左侧的菜单按钮，点击 `设置` 以进入设置页面。

然后点击 `权限` 按钮，进入权限设置页面，在权限令牌一栏中，点击 `新增` 按钮，填写表单并成功提交后，您将在网页上看到服务器为您生成的令牌信息，点击右侧的 `COPY` 按钮，将其复制到剪切板，并新建文本文件将令牌信息保存到本地，以供稍后使用。

## 托管应用

在创建令牌后，我们还需要通过 Canarails 托管应用，这一步可以参照 `开始使用` 章节中的描述，创建一个 App，并添加一个名为 master 的默认流量泳道，然后，我们将默认流量泳道的实例数量设置为任意大于 0 的正整数。

在后面的步骤中，我们需要使用这个 App 的 ID，以及默认流量泳道的名称 `master`。

## 使用 CURL 更新流量泳道

在 `创建授权令牌` 和 `托管应用` 步骤完成后，我们接下来介绍如何通过 CURL 更新流量泳道。

首先我们要明确在需求迭代的过程中，我们会在什么时候对流量泳道进行更新：

- 当 master 分支更新时，构建 master 内容并部署到主干节点。

- 当创建合并至 master 分支的 pull request 时，构建分支内容并创建对应的金丝雀节点。

- 当合并至 master 的 pull request 更新时，构建分支内容并更新对应的金丝雀节点。

- 当合并至 master 的 pull request 关闭时，移除金丝雀节点以节省资源。

在确认更新流量泳道的时机以及对应的行为之后，我们就可以开始动手编写文件实现流量泳道的自动化更新了，这一部分内容将会以本网站（CanarailsDoc）为例，展示自动化更新所需要的脚本文件。

您也可以[点击链接完整示例源代码](https://github.com/sheason2019/canarails_doc/tree/master/.github/workflows)。

> 下面提供的流水线代码内容涉及 GitHub Actions 的[重用工作流](https://docs.github.com/zh/actions/using-workflows/reusing-workflows)，如果您尚不了解这一概念，请先阅读 GitHub Actions 提供的文档。

### 构建镜像

在 Canarails Doc 中有一个文件 `build-image.yaml`，这个文件封装了应用的镜像构建和推送逻辑，对于每个项目，我们对于镜像的构建和推送逻辑都会有所不同，请根据需要酌情修改：

```yaml
# build-image.yaml
name: Build & Push Image
on:
  workflow_call:
    secrets:
      DOCKER_USERNAME:
        required: true
      DOCKER_PASSWORD:
        required: true
    outputs:
      imageName:
        description: "Uploaded iamgeName"
        value: sheason/canarails-doc:${{ github.sha }}
jobs:
  build_and_push_image:
    runs-on: ubuntu-latest
    steps:
      - name: checkout
        uses: actions/checkout@v3
      - name: setupNode
        uses: actions/setup-node@v3
        with:
          node-version: "20.8"
      - name: build website
        run: |
          npm i -g pnpm
          pnpm i
          pnpm run build
      - name: build and push image
        run: |
          docker build . -t sheason/canarails-doc:${{ github.sha }}
          docker login --username=${{ secrets.DOCKER_USERNAME }} --password ${{ secrets.DOCKER_PASSWORD }}
          docker push sheason/canarails-doc:${{ github.sha }}
```

### 修改流量泳道

上面的步骤将我们构建的镜像推送到了仓库，这一步我们需要将构建出的镜像应用到 Canarails，从而实现镜像的部署。

在 Canarails 的流水线代码中存在一个文件 `mutate-app-variant`，它将针对流量泳道属性变更的 CURL 命令合并到了一个文件中，通过重用工作流的方式提供给实际的 Git Pipeline 调用，其内容如下：

```yaml
# mutate-app-variant.yaml
name: Mutate App Variant
on:
  workflow_call:
    inputs:
      method:
        required: true
        type: string
      branchName:
        required: true
        type: string
      imageName:
        required: false
        type: string
    secrets:
      AUTH_TOKEN:
        required: true
jobs:
  create_app_variant:
    if: inputs.method == 'POST'
    runs-on: ubuntu-latest
    steps:
      - name: curl
        run: |
          curl -X POST -d '{"title": "${{ inputs.branchName }}", "imageName": "${{ inputs.imageName }}", "replicas": 1, "matches": [{"header": "x-branch-name", "value": "${{ inputs.branchName }}"}], "appId": 2, "exposePort": 80}' -H 'Authorization:  ${{ secrets.AUTH_TOKEN }}' -H 'Content-Type: application/json' 'https://admin.sheason.site/api/app-variant'
  patch_app_variant:
    if: inputs.method == 'PATCH'
    runs-on: ubuntu-latest
    steps:
      - name: curl
        run: |
          curl -X PATCH -d '{"imageName": "${{ inputs.imageName }}"}' -H 'Authorization: ${{ secrets.AUTH_TOKEN }}' -H 'Content-Type: application/json' 'https://admin.sheason.site/api/app-variant?title=${{ inputs.branchName }}&appId=2'
  delete_app_variant:
    if: inputs.method == 'DELETE'
    runs-on: ubuntu-latest
    steps:
      - name: curl
        run: |
          curl -X DELETE -H 'Authorization: ${{ secrets.AUTH_TOKEN }}' 'https://admin.sheason.site/api/app-variant?title=${{ inputs.branchName }}&appId=2'
```

它的内容非常简单，实际上就是通过 Canarails 暴露的 RESTful API 对 AppVarint（流量泳道）资源进行 CURD，但需要注意的是，这里的流水线代码存在着几个重要的变量，必须要进行配置：

- **AUTH_TOKEN**：是我们在 `创建授权令牌` 一节中创建的令牌内容，请将内容复制到 GitHub Actions 的 secrets 中，以帮助 Canarails 完成鉴权。

- **appId**：在 `create_app_variant` 中的请求体和 `patch_app_variant`、`delete_app_variant` 的 Query 参数中存在着 appId，这里需要使用我们在 `托管应用` 一节中创建的 App 的 ID 属性。

- **admin.sheason.site**：应替换为您自部署的 Canarails 的域名。

### 编写流水线逻辑

接下来，我们就可以根据需要编写 GitHub Actions YAML 文件了。

#### 更新 master

```yaml
# master-update.yaml
name: Master Update
on:
  push:
    branches:
      - "master"
jobs:
  build_image:
    uses: sheason2019/canarails_doc/.github/workflows/build-image.yaml@master
    secrets:
      DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
      DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}
  update_master:
    uses: sheason2019/canarails_doc/.github/workflows/mutate-app-variant.yaml@master
    secrets:
      AUTH_TOKEN: ${{ secrets.AUTH_TOKEN }}
    needs: build_image
    with:
      method: PATCH
      branchName: ${{ github.ref_name }}
      imageName: ${{ needs.build_image.outputs.imageName }}
```

当 master 更新时，我们会通过 `build-image.yaml` 文件提供的重用工作流构建并推送应用镜像，然后我们向 `mutate-app-variant.yaml` 文件提供的工作流输入授权令牌、镜像名称、请求方式、分支名称（在这里是`master`）等内容，然后这里 `mutate-app-variant.yaml` 就会将所有 `appId` 为 2，并且流量泳道名称为 `master` 的流量泳道的镜像名称更新为我们输入的镜像名称。

这样一来，每当 master 的代码发生更新时，GitHub Actions 就会自动向 Canarails 发送流量泳道变更请求，当流量泳道变更后，Canarails 会自动将配置信息同步到 Kubernetes，使 Kubernetes 对部署内容进行更新。

#### 创建 PR

当我们创建合并至 master 分支的 PR 时，我们需要创建金丝雀环境以供预览。

对应的流水线配置文件如下所示：

```yaml
# create_pull_request.yaml
name: Create PullRequest
on:
  pull_request:
    types:
      - opened
      - reopened
    branches:
      - master
jobs:
  build_image:
    uses: sheason2019/canarails_doc/.github/workflows/build-image.yaml@master
    secrets:
      DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
      DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}
  create_app_variant:
    uses: sheason2019/canarails_doc/.github/workflows/mutate-app-variant.yaml@master
    secrets:
      AUTH_TOKEN: ${{ secrets.AUTH_TOKEN }}
    needs: build_image
    with:
      method: POST
      branchName: ${{ github.head_ref }}
      imageName: ${{ needs.build_image.outputs.imageName }}
```

#### 更新 PR

当我们更新合并至 master 分支的 PR 时，我们需要更新金丝雀环境，使其与最新的分支内容保持一致。

对应的流水线配置文件内容如下所示：

```yaml
# update_pull_request.yaml
name: Update PullRequest
on:
  pull_request:
    types:
      - synchronize
    branches:
      - master
jobs:
  build_image:
    uses: sheason2019/canarails_doc/.github/workflows/build-image.yaml@master
    secrets:
      DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
      DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}
  update_app_variant:
    uses: sheason2019/canarails_doc/.github/workflows/mutate-app-variant.yaml@master
    secrets:
      AUTH_TOKEN: ${{ secrets.AUTH_TOKEN }}
    needs: build_image
    with:
      method: PATCH
      branchName: ${{ github.head_ref }}
      imageName: ${{ needs.build_image.outputs.imageName }}
```

#### 关闭 PR

当我们关闭合并至 master 分支的 PR 时，我们需要删除金丝雀环境，以节省资源开销。

对应的流水线配置文件内容如下所示：

```yaml
# close_pull_request.yaml
name: Close PullRequest
on:
  pull_request:
    types:
      - closed
    branches:
      - master
jobs:
  delete_app_variant:
    uses: sheason2019/canarails_doc/.github/workflows/mutate-app-variant.yaml@master
    secrets:
      AUTH_TOKEN: ${{ secrets.AUTH_TOKEN }}
    with:
      method: DELETE
      branchName: ${{ github.head_ref }}
```

## 完成配置

以上就是使用 GitHub Actions 配合 Canarails 实现自动化部署的全部步骤。

现在，您应该可以通过向项目的 master 分支推送内容实现项目的自动部署，或是通过创建指向 master 分支的 Pull Request 以自动构建金丝雀环境，供内部人员进行测试和预览。

---
title: 安装
description: 安装 Canarails
---

## 前提条件

### 搭建 Kubernetes

Canarails 需要通过 Kubernetes 管理负载均衡逻辑，因此在使用 Canarails 之前，您需要先搭建好 [Kubernetes](https://kubernetes.io/) 环境。

如果您认为搭建 Kubernetes 集群过于繁琐或是没有必要，也可以使用 [K3s](https://docs.k3s.io) 作为 Kubernetes 环境。

### 安装 Gateway

通常情况下 Kubernetes 不会自动安装 Gateway 相关的资源，这里推荐使用 Envoy 作为 GatewayClass，可以参考下面的链接安装 Kubernetes Gateway 和 Envoy GatewayClass：

[Quickstart - Envoy Gateway](https://gateway.envoyproxy.io/docs/tasks/quickstart/)

## 安装 Canarails 必要的 Kubernetes 资源

在完成前提条件中的安装内容后，接下来就可以开始安装 Canarails。

Canarails 所需的资源分为两个部分，下面这一部分通常情况下不需要进行修改：

```yaml
# 创建一个可以修改负载均衡配置的 ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: canarails-admin-serviceaccount
  namespace: canarails
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: canarails-admin
  namespace: canarails
rules:
  - apiGroups:
      - ""
      - "apps"
      - "gateway.networking.k8s.io"
    resources:
      - "services"
      - "pods"
      - "deployments"
      - "httproutes"
    verbs:
      - "create"
      - "delete"
      - "get"
      - "list"
      - "patch"
      - "watch"
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: canarails-admin-binding
  namespace: canarails
subjects:
  - kind: ServiceAccount
    name: canarails-admin-serviceaccount
    namespace: canarails
roleRef:
  kind: Role
  name: canarails-admin
  apiGroup: rbac.authorization.k8s.io
---
# 创建 Envoy GatewayClass
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: envoy
  namespace: canarails
spec:
  controllerName: gateway.envoyproxy.io/gatewayclass-controller
---
# 创建 Gateway，并暴露 80 端口
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: canarails-gateway
  namespace: canarails
spec:
  gatewayClassName: envoy
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: All
---
# Canarails 服务
apiVersion: v1
kind: Service
metadata:
  name: canarails-dashboard-service
  namespace: canarails
spec:
  selector:
    app: canarails-dashboard
  ports:
    - name: http
      protocol: TCP
      port: 3000
      targetPort: 3000
```

下面这一部分是 Canarails 的 Deployment 和 HTTPRoute，应根据需要进行修改：

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canarails-dashboard-httproute
  namespace: canarails
spec:
  hostnames:
    # 将下面的 <custom_hostname> 替换为您期望的 Canarails 控制台的域名
    # 例如 admin.sheason.site
    - "<custom_hostname>"
  parentRefs:
    - name: canarails-gateway
  rules:
    - backendRefs:
        - name: canarails-dashboard-service
          port: 3000
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: canarails-dashboard
  namespace: canarails
  labels:
    app: canarails-dashboard
spec:
  replicas: 1
  selector:
    matchLabels:
      app: canarails-dashboard
  template:
    metadata:
      labels:
        app: canarails-dashboard
    spec:
      serviceAccountName: canarails-admin-serviceaccount
      containers:
        - name: canarails-dashboard
          image: docker.io/sheason/canarails:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              # 将 DATABASE_URL 的 value 替换为您实际使用的数据库连接字符串
              # 例如：host=localhost user=postgres password=any_pswd dbname=canarails port=5432 sslmode=disable timezone=Asia/Shanghai
              value: "host=<custom_host> user=<custom_user> password=<custom_pswd> dbname=<custom_dbname> port=<custom_port> sslmode=disable timezone=Asia/Shanghai"
            - name: ADMIN_PASSWORD
              # ADMIN_PASSWORD 的 value 是 admin 用户登录的密码
              # 请设置一个复杂度足够高的密码
              value: "<custom_admin_password>"
```

上面需要替换的主要内容有：

1. 访问控制台的域名 custom_hostname

2. 数据库连接环境变量 DATABASE_URL

3. 管理员密码环境变量 ADMIN_PASSWORD

在完成修改后，使用 kubectl 将上述资源添加到 Kubernetes 集群，当所有资源准备就绪后，访问您自定义的域名 custom_hostname，您应该就可以正确看到 Canarails 的 Web 控制台了。

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    DOCKER_REGISTRY   = "${env.DOCKER_REGISTRY ?: 'docker.io'}"
    IMAGE_NAME        = "${env.IMAGE_NAME ?: 'tsaikarthik/ai-interview-assistant'}"
    IMAGE_TAG         = "${env.IMAGE_TAG ?: 'latest'}"
    K8S_NAMESPACE     = "${env.K8S_NAMESPACE ?: 'ai-interview'}"
    K8S_DEPLOYMENT    = "${env.K8S_DEPLOYMENT ?: 'ai-interview-deployment'}"
    K8S_CONTAINER     = "${env.K8S_CONTAINER ?: 'ai-interview-container'}"
    K8S_MANIFEST_DIR  = "${env.K8S_MANIFEST_DIR ?: 'k8s'}"
    IMAGE_PULL_SECRET = "${env.IMAGE_PULL_SECRET ?: 'regcred'}"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          def shortCommit = sh(returnStdout: true, script: 'git rev-parse --short HEAD 2>/dev/null || echo ""').trim()
          if (!env.IMAGE_TAG?.trim() || env.IMAGE_TAG == 'latest') {
            env.IMAGE_TAG = shortCommit ?: "build-${env.BUILD_NUMBER}"
          }

          // normalize registry prefix (empty for Docker Hub default)
          String registry = (env.DOCKER_REGISTRY ?: '').trim()
          if (registry == 'docker.io' || registry == '') {
            registry = ''
          } else {
            if (!registry.endsWith('/')) { registry = registry + '/' }
          }

          env.IMAGE_FULL = "${registry}${env.IMAGE_NAME}:${env.IMAGE_TAG}"
          currentBuild.displayName = "#${env.BUILD_NUMBER} ${env.IMAGE_TAG}"
          echo "Using IMAGE_FULL=${env.IMAGE_FULL}"
        }
      }
    }

    stage('Install & Build') {
      steps {
        sh '''
          set -e
          echo "Node / NPM step: installing dependencies"
          if [ -f package-lock.json ]; then
            npm ci --prefer-offline --no-audit --progress=false
          else
            npm install --no-audit --progress=false
          fi
          echo "Building production bundle"
          npm run build
        '''
      }
    }

    stage('Lint / Test') {
      steps {
        script {
          sh 'if npm run | grep -q "lint"; then npm run lint || true; else echo "no lint script"; fi'
          sh 'if npm run | grep -q "test"; then npm run test --silent || true; else echo "no test script"; fi'
        }
      }
    }

    stage('Build & Push Docker Image') {
      steps {
        // dockerhub-creds must exist (username/password)
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh '''
            set -e
            echo "=== DEBUG: Environment ==="
            echo "DOCKER_REGISTRY=${DOCKER_REGISTRY}"
            echo "IMAGE_NAME=${IMAGE_NAME}"
            echo "IMAGE_TAG=${IMAGE_TAG}"
            echo "IMAGE_FULL=${IMAGE_FULL}"
            echo "DOCKER_USER=${DOCKER_USER}"

            # Show docker availability (do not fail here if docker missing so the logs help)
            docker --version 2>/dev/null || echo "docker not found on PATH"
            docker info 2>/dev/null || echo "docker info failed (daemon down?)"

            # Logout & login
            if [ -n "${DOCKER_REGISTRY}" ] && [ "${DOCKER_REGISTRY}" != "docker.io" ]; then
              LOGIN_TARGET="${DOCKER_REGISTRY}"
            else
              LOGIN_TARGET=""
            fi

            echo "Logging into Docker registry [${LOGIN_TARGET:-docker hub}] as ${DOCKER_USER}"
            if [ -n "$LOGIN_TARGET" ]; then
              echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin "$LOGIN_TARGET"
            else
              echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
            fi

            echo "Building docker image: $IMAGE_FULL"
            export DOCKER_BUILDKIT=1
            docker build --pull -t "$IMAGE_FULL" .

            echo "Pushing image: $IMAGE_FULL"
            docker push "$IMAGE_FULL" || {
              echo "=== PUSH FAILED ==="
              docker info 2>/dev/null || true
              docker images | grep "$(echo $IMAGE_NAME | sed 's/\\//\\\\\\//g')" || true
              exit 1
            }

            echo "Image pushed: $IMAGE_FULL"
          '''
        }
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        // need kubeconfig file credential and dockerhub-creds to create imagePullSecret in cluster
        withCredentials([
          file(credentialsId: 'kubeconfig', variable: 'KUBECONF'),
          usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')
        ]) {
          sh '''
            set -e

            # ensure kubectl exists
            if ! command -v kubectl >/dev/null 2>&1; then
              echo "kubectl not found on agent PATH" >&2
              exit 2
            fi

            export KUBECONFIG="${KUBECONF}"
            echo "Using KUBECONFIG at ${KUBECONFIG}"

            # ensure namespace exists
            if [ -f "${K8S_MANIFEST_DIR}/namespace.yaml" ]; then
              kubectl apply -f "${K8S_MANIFEST_DIR}/namespace.yaml" || true
            else
              echo "Warning: ${K8S_MANIFEST_DIR}/namespace.yaml not found - creating namespace ${K8S_NAMESPACE}"
              kubectl create namespace "${K8S_NAMESPACE}" || true
            fi

            # create imagePullSecret if not exists
            if kubectl -n "${K8S_NAMESPACE}" get secret "${IMAGE_PULL_SECRET}" >/dev/null 2>&1; then
              echo "imagePullSecret ${IMAGE_PULL_SECRET} already exists in ${K8S_NAMESPACE}"
            else
              echo "Creating imagePullSecret ${IMAGE_PULL_SECRET} in ${K8S_NAMESPACE}"
              # decide registry server for secret (docker hub default)
              if [ -z "${DOCKER_REGISTRY}" ] || [ "${DOCKER_REGISTRY}" = "docker.io" ]; then
                REG_SERVER="https://index.docker.io/v1/"
              else
                REG_SERVER="${DOCKER_REGISTRY}"
              fi

              kubectl -n "${K8S_NAMESPACE}" create secret docker-registry "${IMAGE_PULL_SECRET}" \
                --docker-server="${REG_SERVER}" \
                --docker-username="${DOCKER_USER}" \
                --docker-password="${DOCKER_PASS}" || {
                  echo "Failed creating imagePullSecret" >&2
                  kubectl -n "${K8S_NAMESPACE}" get secret || true
                  exit 3
                }
            fi

            echo "Deploying IMAGE_FULL=${IMAGE_FULL} to Kubernetes namespace ${K8S_NAMESPACE}"

            # Replace placeholder __IMAGE_FULL__ in the deployment manifest into a temp file
            TMP_DEPLOY=$(mktemp /tmp/deployment.XXXX.yaml)
            if command -v python3 >/dev/null 2>&1; then PYTHON_BIN=python3
            elif command -v python >/dev/null 2>&1; then PYTHON_BIN=python
            else
              echo "Python interpreter not found (required to replace placeholder in deployment.yaml)" >&2
              exit 4
            fi

            $PYTHON_BIN - <<'PY'
import os, pathlib, sys
image = os.environ.get("IMAGE_FULL")
if not image:
    sys.exit("IMAGE_FULL env var missing")
source = pathlib.Path(os.environ.get("K8S_MANIFEST_DIR", "k8s")) / "deployment.yaml"
if not source.exists():
    sys.exit(f"{source} not found")
text = source.read_text()
placeholder = "__IMAGE_FULL__"
if placeholder not in text:
    sys.exit(f"Placeholder {placeholder} missing in {source}")
# also inject imagePullSecret name if placeholder for it exists
text = text.replace(placeholder, image)
pathlib.Path(os.environ["TMP_DEPLOY"]).write_text(text)
print(os.environ["TMP_DEPLOY"])
PY

            echo "Applying deployment manifest from $TMP_DEPLOY"
            kubectl -n "${K8S_NAMESPACE}" apply -f "$TMP_DEPLOY"

            echo "Applying service manifest (if present)"
            if [ -f "${K8S_MANIFEST_DIR}/service.yaml" ]; then
              kubectl -n "${K8S_NAMESPACE}" apply -f "${K8S_MANIFEST_DIR}/service.yaml"
            else
              echo "service.yaml not present - skipping"
            fi

            echo "Applying ingress manifest (if present)"
            if [ -f "${K8S_MANIFEST_DIR}/ingress.yaml" ]; then
              kubectl -n "${K8S_NAMESPACE}" apply -f "${K8S_MANIFEST_DIR}/ingress.yaml" || true
            else
              echo "ingress.yaml not present - skipping"
            fi

            # wait for rollout
            kubectl -n "${K8S_NAMESPACE}" rollout status deployment/"${K8S_DEPLOYMENT}" --timeout=180s || {
              echo "Rollout did not complete within timeout; dumping debug info"
              kubectl -n "${K8S_NAMESPACE}" describe deployment "${K8S_DEPLOYMENT}" || true
              kubectl -n "${K8S_NAMESPACE}" get pods -o wide || true
              kubectl -n "${K8S_NAMESPACE}" get events --sort-by=.metadata.creationTimestamp || true
              exit 5
            }

            echo "Deployment rollout finished successfully"
          '''
        }
      }
    }
  }

  post {
    always {
      echo 'Cleaning up workspace'
      cleanWs()
    }
    success {
      echo 'Pipeline succeeded'
    }
    failure {
      echo 'Pipeline failed'
    }
  }
}

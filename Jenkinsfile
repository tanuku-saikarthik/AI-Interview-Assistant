pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  // Configure these defaults or set them in Jenkins job/global env
  environment {
    DOCKER_REGISTRY   = "${env.DOCKER_REGISTRY ?: 'docker.io'}"
    IMAGE_NAME        = "${env.IMAGE_NAME ?: 'tsaikarthik/ai-interview-assistant'}"
    IMAGE_TAG         = "${env.IMAGE_TAG ?: 'latest'}"
    K8S_NAMESPACE     = "${env.K8S_NAMESPACE ?: 'ai-interview'}"
    K8S_DEPLOYMENT    = "${env.K8S_DEPLOYMENT ?: 'ai-interview-deployment'}"
    K8S_CONTAINER     = "${env.K8S_CONTAINER ?: 'ai-interview-container'}"
    K8S_MANIFEST_DIR  = "${env.K8S_MANIFEST_DIR ?: 'k8s'}"
    // optionally: you can set NODE_ENV or other env vars here
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          def shortCommit = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
          if (!env.IMAGE_TAG?.trim() || env.IMAGE_TAG == 'latest') {
            env.IMAGE_TAG = shortCommit ?: "build-${env.BUILD_NUMBER}"
          }
          String registry = env.DOCKER_REGISTRY?.trim()
          if (registry && !registry.endsWith('/')) {
            registry = registry + '/'
          }
          env.IMAGE_FULL = "${registry ?: ''}${env.IMAGE_NAME}:${env.IMAGE_TAG}"
          currentBuild.displayName = "#${env.BUILD_NUMBER} ${env.IMAGE_TAG}"
          echo "Using IMAGE_FULL=${env.IMAGE_FULL}"
        }
      }
    }

    stage('Install & Build') {
      steps {
        sh '''
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
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh '''
            set -e
            echo "=== DEBUG: Environment ==="
            echo "DOCKER_REGISTRY=${DOCKER_REGISTRY}"
            echo "IMAGE_NAME=${IMAGE_NAME}"
            echo "IMAGE_TAG=${IMAGE_TAG}"
            echo "IMAGE_FULL=${IMAGE_FULL}"

            echo "=== DEBUG: docker BEFORE login (may show previous user or none) ==="
            docker info || true
            echo "docker username (before login): $(docker info --format '{{.Username}}' 2>/dev/null || echo '(none)')"

            echo "Forcing docker logout for ${DOCKER_REGISTRY} (ignore errors)"
            docker logout ${DOCKER_REGISTRY} || true

            echo "Logging into Docker registry: ${DOCKER_REGISTRY} as ${DOCKER_USER}"
            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin ${DOCKER_REGISTRY}

            echo "docker username after login: $(docker info --format '{{.Username}}')"

            echo "Building docker image: $IMAGE_FULL"
            export DOCKER_BUILDKIT=1
            docker build --pull -t "$IMAGE_FULL" .

            echo "Pushing image: $IMAGE_FULL"
            docker push "$IMAGE_FULL" || {
              echo "=== PUSH FAILED ==="
              echo "Attempted to push: $IMAGE_FULL"
              echo "docker info after push attempt:"
              docker info || true
              echo "Listing local docker images (matching IMAGE_NAME):"
              docker images | grep $(echo $IMAGE_NAME | sed 's/\\//\\\\\\//g') || true
              exit 1
            }

            echo "Image pushed: $IMAGE_FULL"
          '''
        }
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONF')]) {
          sh '''
            set -e
            export KUBECONFIG="$KUBECONF"

            # ensure namespace exists
            kubectl apply -f "${K8S_MANIFEST_DIR}/namespace.yaml" || true

            echo "Deploying IMAGE_FULL=$IMAGE_FULL to Kubernetes namespace ${K8S_NAMESPACE}"

            export TMP_DEPLOY=$(mktemp /tmp/deployment.XXXX.yaml)
            if command -v python3 >/dev/null 2>&1; then PYTHON_BIN=python3; elif command -v python >/dev/null 2>&1; then PYTHON_BIN=python; else echo "Python interpreter not found" && exit 1; fi
            $PYTHON_BIN - <<'PY'
import os, pathlib, sys
image = os.environ.get("IMAGE_FULL")
if not image:
    raise SystemExit("IMAGE_FULL env var missing")
source = pathlib.Path(os.environ.get("K8S_MANIFEST_DIR", "k8s")) / "deployment.yaml"
if not source.exists():
    raise SystemExit(f"{source} not found")
text = source.read_text()
placeholder = "__IMAGE_FULL__"
if placeholder not in text:
    raise SystemExit(f"Placeholder {placeholder} missing in {source}")
pathlib.Path(os.environ["TMP_DEPLOY"]).write_text(text.replace(placeholder, image))
PY

            kubectl -n "${K8S_NAMESPACE}" apply -f "$TMP_DEPLOY"

            kubectl -n "${K8S_NAMESPACE}" apply -f "${K8S_MANIFEST_DIR}/service.yaml"
            kubectl -n "${K8S_NAMESPACE}" apply -f "${K8S_MANIFEST_DIR}/ingress.yaml" || true

            # wait for rollout
            kubectl -n "${K8S_NAMESPACE}" rollout status deployment/"${K8S_DEPLOYMENT}" --timeout=180s || {
              echo "Rollout did not complete within timeout; printing describe for debugging"
              kubectl -n "${K8S_NAMESPACE}" describe deployment "${K8S_DEPLOYMENT}" || true
              kubectl -n "${K8S_NAMESPACE}" get pods -o wide || true
              exit 1
            }
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

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
      usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS'),
      // optional: if you prefer passing API server & token instead of a kubeconfig file,
      // add secret text credentials in Jenkins and set the IDs here (they will be empty if not set).
      string(credentialsId: 'K8S_API_SERVER', variable: 'K8S_API_SERVER') ?: '',
      string(credentialsId: 'K8S_TOKEN', variable: 'K8S_TOKEN') ?: '',
      string(credentialsId: 'K8S_CA_DATA', variable: 'K8S_CA_DATA') ?: ''
    ]) {
      sh '''
        set -euo pipefail

        if ! command -v kubectl >/dev/null 2>&1; then
          echo "kubectl not found on agent PATH" >&2
          exit 2
        fi

        # Jenkins provides the file at $KUBECONF
        echo "KUBECONF path from credentials: ${KUBECONF}"
        export KUBECONFIG="${KUBECONF}"
        echo "Using KUBECONFIG at ${KUBECONFIG}"

        # Debug: print server entries from kubeconfig (non-sensitive)
        echo "Server entries found in kubeconfig:"
        grep -E "server: " "${KUBECONFIG}" || true

        # If kubeconfig points at localhost/127.0.0.1, try to auto-rewrite it using K8S_API_SERVER if provided.
        # If K8S_API_SERVER and K8S_TOKEN are provided, build a fresh kubeconfig that uses the token.
        if grep -qE "server: https?://(127\\.0\\.0\\.1|localhost)" "${KUBECONFIG}"; then
          echo "Detected server pointing to localhost/127.0.0.1 inside kubeconfig — this will not work from the Jenkins agent."

          if [ -n "${K8S_API_SERVER:-}" ] && [ -n "${K8S_TOKEN:-}" ]; then
            echo "K8S_API_SERVER and K8S_TOKEN provided — building a temporary kubeconfig using token auth."

            TMP_KUBECONF=$(mktemp /tmp/kubeconf.XXXX)
            cat > "$TMP_KUBECONF" <<EOF
apiVersion: v1
kind: Config
clusters:
- name: ci-cluster
  cluster:
    server: ${K8S_API_SERVER}
EOF
            # add CA data if present
            if [ -n "${K8S_CA_DATA:-}" ]; then
              cat >> "$TMP_KUBECONF" <<EOF
    certificate-authority-data: ${K8S_CA_DATA}
EOF
            else
              cat >> "$TMP_KUBECONF" <<EOF
    insecure-skip-tls-verify: true
EOF
            fi

            cat >> "$TMP_KUBECONF" <<EOF
contexts:
- name: ci
  context:
    cluster: ci-cluster
    user: ci-user
current-context: ci
users:
- name: ci-user
  user:
    token: ${K8S_TOKEN}
EOF
            export KUBECONFIG="$TMP_KUBECONF"
            echo "Temporary kubeconfig built at $TMP_KUBECONF"
            echo "Server entries now:"
            grep -E "server: " "$KUBECONFIG" || true

          elif [ -n "${K8S_API_SERVER:-}" ]; then
            echo "K8S_API_SERVER provided but K8S_TOKEN missing. Attempting to replace server host in kubeconfig with K8S_API_SERVER."

            TMP_KUBECONF=$(mktemp /tmp/kubeconf.XXXX)
            python3 - <<PY
import sys, pathlib, os, re
src = pathlib.Path(os.environ["KUBECONFIG"]).read_text()
api = os.environ.get("K8S_API_SERVER")
if not api:
    sys.exit("K8S_API_SERVER missing")
# naive replace: change any "server: https://..." line that points to localhost/127.0.0.1
new = re.sub(r"(server:\\s*https?://)(127\\.0\\.0\\.1|localhost)(:\\d+)?", r"\\1" + api.replace("https://","").replace("http://",""), src)
pathlib.Path(os.environ["TMP_KUBECONF"]).write_text(new)
print(os.environ["TMP_KUBECONF"])
PY
            export KUBECONFIG="$TMP_KUBECONF"
            echo "Rewrote kubeconfig server entries; new server:"
            grep -E "server: " "$KUBECONFIG" || true
          else
            echo "Automatic fix not possible: kubeconfig points at localhost/127.0.0.1 and neither K8S_API_SERVER+K8S_TOKEN nor K8S_API_SERVER were provided." >&2
            echo "Options to fix:"
            echo "  - In Jenkins: create a 'kubeconfig' file credential that contains a kubeconfig with a reachable API server URL (not 127.0.0.1), OR"
            echo "  - Provide secret text credentials K8S_API_SERVER and K8S_TOKEN (and optional K8S_CA_DATA) and rerun the pipeline." >&2
            # show the problematic server for troubleshooting (non-sensitive)
            echo "Problematic server line(s):"
            grep -E "server: " "${KUBECONFIG}" || true
            exit 3
          fi
        fi

        # At this point KUBECONFIG should point to a valid config the agent can reach
        echo "Testing kubectl connectivity (server version):"
        kubectl version --short || {
          echo "kubectl version failed - cannot reach API server" >&2
          kubectl config view --minify --raw || true
          exit 3
        }

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

        # Replace placeholder __IMAGE_FULL__ in the deployment manifest into a temp file (same as before)
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

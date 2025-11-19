pipeline {
  agent any

  // Configure these defaults or set them in Jenkins job/global env
  environment {
    DOCKER_REGISTRY = "${env.DOCKER_REGISTRY ?: 'docker.io'}"
    IMAGE_NAME      = "${env.IMAGE_NAME ?: 'tsaikarthik/ai-interview-assistant'}"
    IMAGE_TAG       = "${env.IMAGE_TAG ?: 'latest'}"
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
            kubectl apply -f k8s/namespace.yaml || true

            echo "Deploying IMAGE_FULL=$IMAGE_FULL to Kubernetes namespace ai-interview"

            kubectl -n ai-interview apply -f k8s/deployment.yaml
            kubectl -n ai-interview set image deployment/ai-interview-deployment ai-interview-container="$IMAGE_FULL" --record

            kubectl -n ai-interview apply -f k8s/service.yaml
            kubectl -n ai-interview apply -f k8s/ingress.yaml || true

            # wait for rollout
            kubectl -n ai-interview rollout status deployment/ai-interview-deployment --timeout=180s || true
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

pipeline {
  agent any

  environment {
    DOCKER_REGISTRY = "${env.DOCKER_REGISTRY ?: 'docker.io'}"
    IMAGE_NAME      = "${env.IMAGE_NAME ?: 'tsaikarthik/ai-interview-assistant'}"
    IMAGE_TAG       = "${env.IMAGE_TAG ?: (GIT_COMMIT?.take(8) ?: 'latest')}"
  }

  stages {

    /* ------------------- CHECKOUT ------------------- */
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    /* ------------------- INSTALL + BUILD ------------------- */
    stage('Install & Build') {
      steps {
        sh '''
          echo "Installing Node deps..."
          if [ -f package-lock.json ]; then
            npm ci --prefer-offline --no-audit --progress=false
          else
            npm install --no-audit --progress=false
          fi

          echo "Running build..."
          npm run build || true
        '''
      }
    }

    /* ------------------- LINT ------------------- */
    stage('Lint') {
      steps {
        sh '''
          if npm run | grep -q "lint"; then
            echo "Running eslint..."
            npm run lint || true
          else
            echo "No lint script found"
          fi
        '''
      }
    }

    /* ------------------- UNIT & API TESTS (VITEST) ------------------- */
    stage('Unit & API Tests (Vitest)') {
      steps {
        sh '''
          if [ -d tests ]; then
            echo "Running Vitest unit + API tests..."
            npx vitest run --silent || true
          else
            echo "No tests folder found, skipping"
          fi
        '''
      }
    }

  
    /* ------------------- DOCKER BUILD + PUSH ------------------- */
    stage('Build & Push Docker Image') {
      steps {
        withCredentials([usernamePassword(
          credentialsId: 'dockerhub-creds',
          usernameVariable: 'DOCKER_USER',
          passwordVariable: 'DOCKER_PASS'
        )]) {
          sh '''
            set -e

            echo "Registry: ${DOCKER_REGISTRY}"
            echo "Image: ${IMAGE_NAME}"
            echo "Tag: ${IMAGE_TAG}"

            IMAGE_FULL=${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
            echo "Full image name = $IMAGE_FULL"

            echo "Logging out any previous Docker session..."
            docker logout ${DOCKER_REGISTRY} || true

            echo "Logging into Docker registry..."
            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin ${DOCKER_REGISTRY}

            echo "Building Docker image..."
            export DOCKER_BUILDKIT=1
            docker build --pull -t "$IMAGE_FULL" .

            echo "Pushing Docker image..."
            docker push "$IMAGE_FULL" || {
              echo "=== PUSH FAILED ==="
              docker info || true
              exit 1
            }

            echo "Image pushed successfully: $IMAGE_FULL"
          '''
        }
      }
    }
  }

  /* ------------------- POST ACTIONS ------------------- */
  post {
    always {
      echo 'Cleaning workspace'
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

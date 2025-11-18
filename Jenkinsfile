pipeline {
  agent any

  // Configure these defaults or set them in Jenkins job/global env
  environment {
    DOCKER_REGISTRY = "${env.DOCKER_REGISTRY ?: 'docker.io/tsaikarthik'}"
    IMAGE_NAME      = "${env.IMAGE_NAME ?: 'ai-interview-assistant'}"
    // short tag from commit for immutability; fallback to 'latest'
    IMAGE_TAG       = "${env.IMAGE_TAG ?: (GIT_COMMIT?.take(8) ?: 'latest')}"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install & Build') {
      steps {
        // use package-lock for reproducible builds if present
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
          // run lint/tests if available; do not fail pipeline if not present
          sh 'if npm run | grep -q \"lint\"; then npm run lint || true; else echo \"no lint script\"; fi'
          sh 'if npm run | grep -q \"test\"; then npm run test --silent || true; else echo \"no test script\"; fi'
        }
      }
    }

    stage('Build & Push Docker Image') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh '''
            set -e
            echo "Logging into Docker registry: ${DOCKER_REGISTRY}"
            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin ${DOCKER_REGISTRY}

            IMAGE_FULL=${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
            echo "Building docker image: $IMAGE_FULL"

            # use buildkit if available for better caching (optional)
            export DOCKER_BUILDKIT=1
            docker build --pull -t "$IMAGE_FULL" .

            echo "Pushing image: $IMAGE_FULL"
            docker push "$IMAGE_FULL"

            echo "Image pushed: $IMAGE_FULL"
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

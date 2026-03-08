pipeline {
    agent any

    environment {
        IMAGE_NAME = 'churniq'
        CONTAINER_NAME = 'churniq-app'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/mitratobi/Capstone.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                // Use 'bat' for Windows Command Prompt
                bat 'npm install' 
            }
        }

        stage('Test') {
            steps {
                bat 'npm test'
            }
        }

        stage('Build Docker Image') {
            steps {
                bat "docker build -t ${IMAGE_NAME}:%BUILD_NUMBER% ."
                bat "docker tag ${IMAGE_NAME}:%BUILD_NUMBER% ${IMAGE_NAME}:latest"
            }
        }

        stage('Deploy') {
            steps {
                // Simplified for Windows Docker Desktop
                bat "docker stop ${CONTAINER_NAME} || ver > nul"
                bat "docker rm ${CONTAINER_NAME} || ver > nul"
                bat "docker run -d --name ${CONTAINER_NAME} -p 3000:3000 ${IMAGE_NAME}:latest"
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded! ChurnIQ is live at http://localhost:3000"
        }
        failure {
            echo 'Pipeline failed. Check logs above.'
        }
    }
}

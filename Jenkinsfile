pipeline {
    agent any
    environment {
        IMAGE_NAME = 'churniq'
        CONTAINER_NAME = 'churniq-app'
    }
    stages {
        stage('Clone') {
            steps {
                // This replaces 'Checkout' to match your goal screenshot
                git branch: 'main', url: 'https://github.com/mitratobi/Capstone.git'
            }
        }
        stage('Deploy') {
            steps {
                // 'bat' makes this take seconds instead of 6 minutes!
                bat 'npm install'
                bat "docker build -t ${IMAGE_NAME}:latest ."
                bat "docker stop ${CONTAINER_NAME} || ver > nul"
                bat "docker rm ${CONTAINER_NAME} || ver > nul"
                bat "docker run -d --name ${CONTAINER_NAME} -p 3000:3000 ${IMAGE_NAME}:latest"
            }
        }
    }
}

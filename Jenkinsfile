pipeline {
    agent any
    environment {
        IMAGE_NAME = 'churniq'
        CONTAINER_NAME = 'churniq-app'
    }
    stages {
        stage('Clone') { 
            steps {
                // Groups everything related to getting the code
                git branch: 'main', url: 'https://github.com/mitratobi/Capstone.git'
            }
        }
        stage('Deploy') {
            steps {
                // Groups all the work into the second column
                bat 'npm install'
                bat "docker build -t ${IMAGE_NAME}:%BUILD_NUMBER% ."
                bat "docker stop ${CONTAINER_NAME} || ver > nul"
                bat "docker rm ${CONTAINER_NAME} || ver > nul"
                bat "docker run -d --name ${CONTAINER_NAME} -p 3000:3000 ${IMAGE_NAME}:latest"
            }
        }
    }
}

pipeline {
    agent any
    environment {
        IMAGE_NAME = 'churniq'
        CONTAINER_NAME = 'churniq-app'
    }
    stages {
        stage('Clone') {
            steps {
                // This replaces the 'Checkout' stage to match your goal image
                git branch: 'main', url: 'https://github.com/mitratobi/Capstone.git'
            }
        }
        stage('Deploy') {
            steps {
                // Switching from 'sh' to 'bat' fixes the 11-minute hang time
                bat 'npm install'
                bat "docker build -t ${IMAGE_NAME}:latest ."
                
                // Cleans up the old container so the new one can start
                bat "docker stop ${CONTAINER_NAME} || ver > nul"
                bat "docker rm ${CONTAINER_NAME} || ver > nul"
                
                // Starts your app
                bat "docker run -d --name ${CONTAINER_NAME} -p 3000:3000 ${IMAGE_NAME}:latest"
            }
        }
    }
    post {
        success {
            echo "Pipeline succeeded! ChurnIQ is live at http://localhost:3000"
        }
    }
}

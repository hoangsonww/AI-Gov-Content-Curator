#!/usr/bin/env groovy

@Library('shared-pipeline-library') _

pipeline {
    agent any

    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['dev', 'staging', 'prod'],
            description: 'Target environment for deployment'
        )
        choice(
            name: 'DEPLOYMENT_STRATEGY',
            choices: ['blue-green', 'canary', 'rolling', 'recreate'],
            description: 'Deployment strategy to use'
        )
        choice(
            name: 'PLATFORM',
            choices: ['aws', 'kubernetes', 'both'],
            description: 'Deployment platform'
        )
        string(
            name: 'IMAGE_TAG',
            defaultValue: '',
            description: 'Image tag (required). Use commit SHA or build number. Do NOT use latest.'
        )
        booleanParam(
            name: 'RUN_SECURITY_SCAN',
            defaultValue: true,
            description: 'Run security scanning'
        )
        booleanParam(
            name: 'RUN_PERFORMANCE_TESTS',
            defaultValue: false,
            description: 'Run performance tests'
        )
        booleanParam(
            name: 'AUTO_APPROVE',
            defaultValue: false,
            description: 'Skip manual approval'
        )
    }

    environment {
        AWS_REGION = 'us-east-1'
        ECR_REGISTRY = credentials('ecr-registry')
        GITHUB_TOKEN = credentials('github-token')
        GITHUB_USERNAME = credentials('github-username')
        SLACK_CHANNEL = '#deployments'
        DOCKER_BUILDKIT = '1'
        SPLUNK_HEC_URL = credentials('splunk-hec-url')
        SPLUNK_HEC_TOKEN = credentials('splunk-hec-token')
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '30'))
        disableConcurrentBuilds()
        timeout(time: 2, unit: 'HOURS')
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                script {
                    notifySlack('STARTED', "Deployment to ${params.ENVIRONMENT} started")
                }
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                    env.BUILD_TAG = "${env.GIT_COMMIT_SHORT}-${env.BUILD_NUMBER}"
                }
            }
        }

        stage('Install Dependencies') {
            options {
                timeout(time: 15, unit: 'MINUTES')
            }
            parallel {
                stage('Backend Dependencies') {
                    steps {
                        dir('backend') {
                            sh 'npm ci'
                        }
                    }
                }
                stage('Frontend Dependencies') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci'
                        }
                    }
                }
                stage('Crawler Dependencies') {
                    steps {
                        dir('crawler') {
                            sh 'npm ci'
                        }
                    }
                }
                stage('Newsletter Dependencies') {
                    steps {
                        dir('newsletters') {
                            sh 'npm ci'
                        }
                    }
                }
            }
        }

        stage('Code Quality') {
            parallel {
                stage('Linting') {
                    steps {
                        sh '''
                            npm run lint || true
                            npm run lint:backend || true
                            npm run lint:frontend || true
                        '''
                    }
                }
                stage('Security Scan') {
                    when {
                        expression { params.RUN_SECURITY_SCAN }
                    }
                    steps {
                        script {
                            // npm audit
                            sh 'npm audit --audit-level=high --production || true'

                            // Snyk scan
                            sh '''
                                npx snyk test --severity-threshold=high
                                npx snyk code test
                            '''

                            // Trivy scan
                            sh '''
                                trivy fs --severity HIGH,CRITICAL --exit-code 0 .
                            '''
                        }
                    }
                }
                stage('License Check') {
                    steps {
                        sh 'npx license-checker --summary || true'
                    }
                }
            }
        }

        stage('Unit Tests') {
            parallel {
                stage('Backend Tests') {
                    steps {
                        dir('backend') {
                            sh 'npm test -- --coverage --ci'
                        }
                    }
                }
                stage('Frontend Tests') {
                    steps {
                        dir('frontend') {
                            sh 'npm test -- --coverage --ci'
                        }
                    }
                }
            }
            post {
                always {
                    junit '**/test-results/**/*.xml'
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'coverage',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])
                }
            }
        }

        stage('Build Docker Images') {
            options {
                timeout(time: 15, unit: 'MINUTES')
            }
            steps {
                script {
                    parallel(
                        backend: {
                            buildDockerImage('backend', env.BUILD_TAG)
                        },
                        frontend: {
                            buildDockerImage('frontend', env.BUILD_TAG)
                        },
                        crawler: {
                            buildDockerImage('crawler', env.BUILD_TAG)
                        },
                        newsletter: {
                            buildDockerImage('newsletters', env.BUILD_TAG)
                        }
                    )
                }
            }
        }

        stage('Container Security Scan') {
            when {
                expression { params.RUN_SECURITY_SCAN }
            }
            steps {
                script {
                    def services = ['backend', 'frontend', 'crawler', 'newsletters']
                    services.each { service ->
                        sh """
                            trivy image --severity HIGH,CRITICAL \
                                --exit-code 0 \
                                ghcr.io/hoangsonww/ai-curator-${service}:${env.BUILD_TAG}
                        """
                    }
                }
            }
        }

        stage('Push Images') {
            steps {
                script {
                    withCredentials([string(credentialsId: 'github-token', variable: 'GITHUB_TOKEN')]) {
                        sh 'echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin'

                        def services = ['backend', 'frontend', 'crawler', 'newsletters']
                        services.each { service ->
                            sh "docker push ghcr.io/hoangsonww/ai-curator-${service}:${env.BUILD_TAG}"
                            if (params.ENVIRONMENT == 'prod') {
                                sh "docker tag ghcr.io/hoangsonww/ai-curator-${service}:${env.BUILD_TAG} ghcr.io/hoangsonww/ai-curator-${service}:latest"
                                sh "docker push ghcr.io/hoangsonww/ai-curator-${service}:latest"
                            }
                        }
                    }
                }
            }
        }

        stage('Terraform Plan') {
            when {
                expression { params.PLATFORM in ['aws', 'both'] }
            }
            steps {
                dir('infrastructure/terraform') {
                    sh '''
                        terraform init -upgrade
                        terraform plan -var="environment=${ENVIRONMENT}" -out=tfplan
                    '''
                    script {
                        env.TERRAFORM_PLAN_EXITCODE = sh(
                            script: 'terraform show -json tfplan | jq -r .resource_changes[].change.actions[]',
                            returnStatus: true
                        )
                    }
                }
            }
        }

        stage('Approval') {
            when {
                expression { !params.AUTO_APPROVE && params.ENVIRONMENT == 'prod' }
            }
            steps {
                script {
                    timeout(time: 1, unit: 'HOURS') {
                        input message: 'Deploy to production?', ok: 'Deploy'
                    }
                }
            }
        }

        stage('Terraform Apply') {
            when {
                expression { params.PLATFORM in ['aws', 'both'] }
            }
            steps {
                dir('infrastructure/terraform') {
                    sh 'terraform apply -auto-approve tfplan'
                }
            }
        }

        stage('Backup') {
            when {
                expression { params.ENVIRONMENT == 'prod' }
            }
            steps {
                script {
                    sh '''
                        # Create backup before deployment
                        aws s3 sync s3://ai-curator-backups/latest s3://ai-curator-backups/$(date +%Y%m%d-%H%M%S)
                    '''
                }
            }
        }

        stage('Deploy') {
            options {
                timeout(time: 15, unit: 'MINUTES')
            }
            parallel {
                stage('Deploy to AWS') {
                    when {
                        expression { params.PLATFORM in ['aws', 'both'] }
                    }
                    steps {
                        script {
                            sh """
                                chmod +x infrastructure/scripts/deploy-aws.sh
                                ./infrastructure/scripts/deploy-aws.sh ${params.ENVIRONMENT} all ${params.DEPLOYMENT_STRATEGY}
                            """
                        }
                    }
                }
                stage('Deploy to Kubernetes') {
                    when {
                        expression { params.PLATFORM in ['kubernetes', 'both'] }
                    }
                    steps {
                        script {
                            sh """
                                chmod +x infrastructure/scripts/deploy-k8s.sh
                                ./infrastructure/scripts/deploy-k8s.sh ai-curator all deploy ${env.BUILD_TAG}
                            """
                        }
                    }
                }
            }
        }

        stage('Integration Tests') {
            steps {
                script {
                    sh '''
                        npm run test:integration
                    '''
                }
            }
        }

        stage('Performance Tests') {
            when {
                expression { params.RUN_PERFORMANCE_TESTS }
            }
            steps {
                script {
                    sh '''
                        # Run k6 performance tests
                        k6 run --vus 10 --duration 30s tests/performance/load-test.js || true
                    '''
                }
            }
            post {
                always {
                    publishHTML([
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'test-results/performance',
                        reportFiles: 'index.html',
                        reportName: 'Performance Test Results'
                    ])
                }
            }
        }

        stage('Smoke Tests') {
            steps {
                script {
                    retry(3) {
                        sh '''
                            npm run test:smoke
                        '''
                    }
                }
            }
        }

        stage('Promote Canary') {
            when {
                allOf {
                    expression { params.DEPLOYMENT_STRATEGY == 'canary' }
                    expression { params.PLATFORM in ['kubernetes', 'both'] }
                }
            }
            steps {
                timeout(time: 30, unit: 'MINUTES') {
                    input message: 'Promote canary deployment?', ok: 'Promote'
                }
                script {
                    sh '''
                        chmod +x infrastructure/scripts/deploy-k8s.sh
                        ./infrastructure/scripts/deploy-k8s.sh ai-curator backend promote
                        ./infrastructure/scripts/deploy-k8s.sh ai-curator frontend promote
                    '''
                }
            }
        }

        stage('Database Migrations') {
            when {
                expression { params.ENVIRONMENT != 'dev' }
            }
            steps {
                script {
                    // TODO: Implement actual migration runner (e.g., migrate-mongo, prisma migrate)
                    echo "⚠️  Database migration stage is a placeholder — no migrations configured"
                }
            }
        }

    }

    post {
        always {
            cleanWs()
            script {
                notifySplunk('COMPLETED', [
                    environment: params.ENVIRONMENT,
                    platform: params.PLATFORM,
                    strategy: params.DEPLOYMENT_STRATEGY,
                    build_tag: env.BUILD_TAG,
                    result: currentBuild.result ?: 'SUCCESS',
                    duration: currentBuild.durationString
                ])
            }
        }
        success {
            script {
                notifySplunk('SUCCESS', [
                    environment: params.ENVIRONMENT,
                    platform: params.PLATFORM,
                    strategy: params.DEPLOYMENT_STRATEGY,
                    build_tag: env.BUILD_TAG
                ])
                notifySlack('SUCCESS', """
                    ✅ Deployment to ${params.ENVIRONMENT} successful!
                    Platform: ${params.PLATFORM}
                    Strategy: ${params.DEPLOYMENT_STRATEGY}
                    Build: ${env.BUILD_TAG}
                """)
            }
        }
        failure {
            script {
                notifySplunk('FAILURE', [
                    environment: params.ENVIRONMENT,
                    platform: params.PLATFORM,
                    build_url: env.BUILD_URL,
                    build_tag: env.BUILD_TAG
                ])
                notifySlack('FAILURE', """
                    ❌ Deployment to ${params.ENVIRONMENT} failed!
                    Platform: ${params.PLATFORM}
                    Check logs: ${env.BUILD_URL}
                """)
            }
        }
        unstable {
            script {
                notifySplunk('UNSTABLE', [
                    environment: params.ENVIRONMENT,
                    platform: params.PLATFORM,
                    build_tag: env.BUILD_TAG
                ])
                notifySlack('UNSTABLE', """
                    ⚠️  Deployment to ${params.ENVIRONMENT} unstable
                    Platform: ${params.PLATFORM}
                """)
            }
        }
    }
}

def buildDockerImage(String service, String tag) {
    dir(service) {
        sh """
            docker build \
                --build-arg BUILD_DATE=\$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
                --build-arg VCS_REF=${env.GIT_COMMIT_SHORT} \
                --build-arg VERSION=${tag} \
                --cache-from ghcr.io/hoangsonww/ai-curator-${service}:latest \
                -t ghcr.io/hoangsonww/ai-curator-${service}:${tag} \
                .
        """
    }
}

def notifySlack(String status, String message) {
    def color = status == 'SUCCESS' ? 'good' : status == 'FAILURE' ? 'danger' : 'warning'

    slackSend(
        channel: env.SLACK_CHANNEL,
        color: color,
        message: message
    )
}

def notifySplunk(String status, Map eventData) {
    def payload = [
        time: System.currentTimeMillis() / 1000,
        source: 'jenkins',
        sourcetype: 'jenkins:deployment',
        index: 'ai_curator_deployments',
        host: env.NODE_NAME ?: 'jenkins',
        event: [
            status: status,
            job_name: env.JOB_NAME,
            build_number: env.BUILD_NUMBER,
            build_url: env.BUILD_URL,
            git_commit: env.GIT_COMMIT_SHORT,
            timestamp: new Date().format("yyyy-MM-dd'T'HH:mm:ss'Z'", TimeZone.getTimeZone('UTC'))
        ] + eventData
    ]

    try {
        def jsonPayload = groovy.json.JsonOutput.toJson(payload)
        httpRequest(
            url: "${env.SPLUNK_HEC_URL}/services/collector/event",
            httpMode: 'POST',
            contentType: 'APPLICATION_JSON',
            customHeaders: [[name: 'Authorization', value: "Splunk ${env.SPLUNK_HEC_TOKEN}"]],
            requestBody: jsonPayload,
            validResponseCodes: '200',
            quiet: true
        )
    } catch (Exception e) {
        echo "Warning: Failed to send event to Splunk: ${e.message}"
    }
}

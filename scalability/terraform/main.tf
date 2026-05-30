# Terraform AWS EKS Cluster Configuration
# For 100K concurrent users with auto-scaling

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = var.environment
      Project    = "valueskins"
      ManagedBy = "terraform"
    }
  }
}

# EKS Cluster
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"
  
  cluster_name    = "valueskins-${var.environment}"
  cluster_version = "1.28"
  
  vpc_id                   = module.vpc.vpc_id
  subnet_ids              = module.vpc.private_subnets
  cluster_security_group = module.eks.cluster_security_group_id
  
  # EKS Managed Node Groups
  managed_node_groups = {
    api_gateway = {
      name           = "api-gateway"
      instance_types = ["m7i.xlarge"]
      capacity_type  = "ON_DEMAND"
      
      min_size     = 3
      max_size     = 50
      desired_size = 3
      
      # High memory for Rust services
      labels = {
        tier = "backend"
        app  = "api-gateway"
      }
      
      tags = {
        "k8s.io/cluster-autoscaler/enabled" = "true"
        "k8s.io/cluster-autoscaler"         = "valueskins-${var.environment}"
      }
    }
    
    frontend = {
      name           = "frontend"
      instance_types = ["m7i.large"]
      capacity_type  = "ON_DEMAND"
      
      min_size     = 2
      max_size     = 30
      desired_size = 3
      
      labels = {
        tier = "frontend"
        app  = "frontend"
      }
    }
    
    redis = {
      name           = "redis"
      instance_types = ["r7i.xlarge"]
      capacity_type  = "ON_DEMAND"
      
      min_size     = 3
      max_size     = 10
      desired_size = 3
      
      labels = {
        tier = "cache"
        app  = "redis"
      }
    }
    
    pgbouncer = {
      name           = "pgbouncer"
      instance_types = ["m7i.large"]
      capacity_type  = "ON_DEMAND"
      
      min_size     = 2
      max_size     = 6
      desired_size = 2
      
      labels = {
        tier = "database"
        app  = "pgbouncer"
      }
    }
  }
  
  # Enable cluster autoscaler
  clusterAutoscaler = {
    expander = "least-waste"
  }
  
  # Manage kubeconfig
  manage_aws_auth_configmap = true
  
  # CoreDNS
  enable_cluster_dns = true
  cluster_dns = "10.100.0.10"
  
  # Metrics Server
  enable_metrics_server = true
  
  tags = var.common_tags
}

# AWS Auth ConfigMap for kubectl
resource "aws_eks_cluster_auth" "this" {
  name = module.eks.cluster_name
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = module.eks.cluster_certificate_authority_data
  token                  = aws_eks_cluster_auth.this.token
  
  load_config_file = false
}

# Karpenter - Next-gen node auto-scaling
module "karpenter" {
  source  = "terraform-aws-modules/karpenter/aws"
  version = "~> 0.4"
  
  cluster_name = module.eks.cluster_name
  irsa_role_name = "valueskins-karpenter"
  
  # Node templates for different workloads
  node_templates = {
    api_gateway = {
      name = "api-gateway"
      ami_family = "AL2023"
      instance_types = ["m7i.xlarge", "m7i.2xlarge"]
      
      labels = {
        tier = "backend"
        app  = "api-gateway"
      }
      
      requirements = {
        cpu = { min = 2, max = 8 }
        memory = { min = "4Gi", max = "32Gi" }
      }
    }
    
    frontend = {
      name = "frontend"
      ami_family = "AL2023"
      instance_types = ["m7i.large", "m7i.xlarge"]
      
      labels = {
        tier = "frontend"
        app  = "frontend"
      }
      
      requirements = {
        cpu = { min = 1, max = 4 }
        memory = { min = "2Gi", max = "16Gi" }
      }
    }
  }
  
  # Default provisioner
  provisioner = {
    name = "default"
    
    requirements = {
      cpu = { min = 1, max = 64 }
      memory = { min = "1Gi", max = "256Gi" }
    }
    
    limits = {
      cpu = "1000"
      memory = "1000Gi"
    }
  }
}
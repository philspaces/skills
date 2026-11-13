# Synthetic review fixture, not a deployable stack: packaging and provider setup omitted.
resource "aws_s3_bucket" "documents" {
  bucket = "synthetic-diagram-example-documents"
}
resource "aws_iam_role" "worker" {
  name = "synthetic-diagram-worker"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy" "worker" {
  role = aws_iam_role.worker.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "*" },
      { Effect = "Deny", Action = "s3:GetObject", Resource = "${aws_s3_bucket.documents.arn}/*" }
    ]
  })
}
resource "aws_lambda_function" "worker" {
  function_name = "synthetic-diagram-worker"
  role          = aws_iam_role.worker.arn
  handler       = "handler.main"
  runtime       = "python3.13"
  filename      = "worker.zip"
  environment { variables = { BUCKET = aws_s3_bucket.documents.id } }
}

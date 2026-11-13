"""Synthetic fixture. Do not execute: it demonstrates an intentionally denied call."""
import os
import boto3

def main(event, context):
    print("Reading document")
    return boto3.client("s3").get_object(Bucket=os.environ["BUCKET"], Key=event["key"])

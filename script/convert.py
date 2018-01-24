#!/usr/bin/python3
import argparse
import os
import json
import csv

def main(args):
    results = []
    i=0
    while True:
        filename = os.path.join(args.input_dir, str(i)+"_keypoints.json")
        if not os.path.exists(filename):
            break
        print(i, filename)
        with open(filename) as f:
            result = json.loads(f.read())
            results.append(result)
        i += 1
    with open(args.output, "w") as f:
         for result in results:
            f.write(json.dumps(result)+"\n")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='watch')
    parser.add_argument('--input_dir', default="./", help='input path')
    parser.add_argument('--output', default="./results.json", help='output path')
    args = parser.parse_args()
    main(args)
<p align="center">
  <a href="https://github.com/kishikawakatsumi/xcresulttool/actions"><img alt="xcresulttool status" src="https://github.com/kishikawakatsumi/xcresulttool/workflows/build-test/badge.svg"></a>
</p>

# xcresulttool GitHub Action

A GitHub Action that generates a human-readable test report from the Xcode result bundle and shows it on GitHub Checks.

<img width="600" alt="Screen Shot" src="https://user-images.githubusercontent.com/40610/138135764-e9c30d24-2dee-4db7-abfd-1533ec5ec2bc.png">

The result is formatted into a test report that shows the success or failure of the tests, logs, activities, and saved screenshots.

Here is [an example result](https://github.com/kishikawakatsumi/xcresulttool-example/pull/2/checks?check_run_id=3954797886).

<img width="300" height="300" alt="Screen Shot" src="https://user-images.githubusercontent.com/40610/138133779-fcf57fde-ef67-4207-a2ed-6d13c47842aa.png"> <img width="300" height="300" alt="Screen Shot" src="https://user-images.githubusercontent.com/40610/138133993-0573480d-1840-4f3e-987f-af928978972f.png">

<img width="300" height="300" alt="Screen Shot" src="https://user-images.githubusercontent.com/40610/138134540-823d2cb5-82c0-45b6-a551-f68c4befa08d.png"> <img width="300" height="300" alt="Screen Shot" src="https://user-images.githubusercontent.com/40610/138134559-43fc5f7a-6ce3-4992-b3e6-f6c3cd995dfb.png">

<img width="300" height="300" alt="Screen Shot" src="https://user-images.githubusercontent.com/40610/138134800-38262042-e053-4522-ac9b-308e0046e872.png"> <img width="300" height="300" alt="Screen Shot" src="https://user-images.githubusercontent.com/40610/138134810-9c9f5a94-4642-482c-9414-ee83bd74f917.png">

### Pre-Requisites

This action only works on macOS builders.

By default `xcodebuild` will generate the `xcresult` bundle file to a randomly named directory in `DerivedData`. To use this action `xcodebuild`
needs to generate `xcresult` bundle to an accessible location.

This can be done using the `-resultBundlePath` flag in `xcodebuild`.

The following action uses a script action to invoke xcodebuild and store the results
in `TestResults.xcresult`

```yaml
jobs:
  test:
    runs-on: macos-11
      - name: Run Tests
        run: |
          xcodebuild -scheme MyFramework -resultBundlePath TestResults test
```

# Usage

> For complete input/output documentation, see [action.yml](action.yml).

## Example

```yaml
- uses: kishikawakatsumi/xcresulttool@v1.0.1
  with:
    path: TestResults.xcresult
  if: always()
  # ^ This is important because the action will be run
  # even if the test fails in the previous step.
```

```yaml
jobs:
  test:
    runs-on: macos-11
    name: Test
    steps:
      - uses: actions/checkout@v2
      - name: Test
        run: |
          xcodebuild -scheme MyFramework -resultBundlePath TestResults test

      - uses: kishikawakatsumi/xcresulttool@v1.0.1
        with:
          path: TestResults.xcresult
        if: always()
        # ^ This is important because the action will be run
        # even if the test fails in the previous step.
```

## Multiple result bundle paths

```yaml
- uses: kishikawakatsumi/xcresulttool@v1.0.1
  with:
    path: |
      results/Example.xcresult
      results/TestResult.xcresult
      results/Result.xcresult
  if: always()
```

## Input parameters

```yaml
- uses: kishikawakatsumi/xcresulttool@v1.0.1
  with:
    # Path to the xcresult bundle.
    path: 'TestResults.xcresult'

    # The GitHub authentication token to create the check.
    #
    # Default: ${{ github.token }}
    token: ''

    # Title for the check results.
    #
    # Default: 'Xcode test results'
    title:
```

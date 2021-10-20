<p align="center">
  <a href="https://github.com/actions/typescript-action/actions"><img alt="typescript-action status" src="https://github.com/actions/typescript-action/workflows/build-test/badge.svg"></a>
</p>

# xcresulttool GitHub Action

A GitHub Action that generates a human-readable test report from the Xcode result bundle and shows it on GitHub Checks.

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
- uses: kishikawakatsumi/xcresulttool@v1
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

      - uses: kishikawakatsumi/xcresulttool@v1
        with:
          path: TestResults.xcresult
        if: always()
        # ^ This is important because the action will be run
        # even if the test fails in the previous step.
```

## Multiple result bundle paths

```yaml
- uses: kishikawakatsumi/xcresulttool@v1
  with:
    path: |
      results/Example.xcresult
      results/TestResult.xcresult
      results/Result.xcresult
  if: always()
```

# Input parameters

```yaml
- uses: kishikawakatsumi/xcresulttool@v1
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

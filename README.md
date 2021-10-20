<p align="center">
  <a href="https://github.com/actions/typescript-action/actions"><img alt="typescript-action status" src="https://github.com/actions/typescript-action/workflows/build-test/badge.svg"></a>
</p>

# xcresulttool GitHub Action

A GitHub Action that generates a human-readable test report from the Xcode result bundle and shows it on GitHub Checks.

## Usage

<!-- start usage -->

```yaml
- uses: kishikawakatsumi/xcresulttool@main
  with:
    # Path to the xcresult bundle.
    path: 'Results.xcresult'

    # The GitHub authentication token to create the check.
    #
    # Default: ${{ github.token }}
    token: ''

    # Title for the check results.
    #
    # Default: 'Xcode test results'
    title:
  if: always()
```

<!-- end usage -->

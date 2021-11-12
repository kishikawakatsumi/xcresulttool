## Build Summary

<b>Compile ViewController.swift (x86_64)</b>
error:&nbsp;Swift Compiler Error:&nbsp;Consecutive statements on a line must be separated by ';'
error:&nbsp;Swift Compiler Error:&nbsp;Expected expression
```
xcresulttool-example/ViewController.swift:7:28: error: consecutive statements on a line must be separated by ';'
        super.viewDidLoad())
                           ^
                           ;
xcresulttool-example/ViewController.swift:7:28: error: expected expression
        super.viewDidLoad())
                           ^
```

<b>Compile SceneDelegate.swift (x86_64)</b>
error:&nbsp;Swift Compiler Error:&nbsp;Unnamed parameters must be written with the empty name '_'
error:&nbsp;Swift Compiler Error:&nbsp;Cannot find type 'Type' in scope
error:&nbsp;Swift Compiler Error:&nbsp;Cannot find type 'parameters' in scope
```
xcresulttool-example/SceneDelegate.swift:6:15: error: unnamed parameters must be written with the empty name '_'
    func name(parameters) -> Type {
              ^
              _: 
xcresulttool-example/SceneDelegate.swift:6:30: error: cannot find type 'Type' in scope
    func name(parameters) -> Type {
                             ^~~~
xcresulttool-example/SceneDelegate.swift:6:15: error: cannot find type 'parameters' in scope
    func name(parameters) -> Type {
              ^~~~~~~~~~
```



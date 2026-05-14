require "json"

package = JSON.parse(File.read(File.join(__dir__, "../package.json")))

Pod::Spec.new do |s|
  s.name         = "RustJsiBridge"
  s.version      = package["version"]
  s.summary      = "Rust JSI bridge for silent-pay-wallet"
  s.homepage     = "https://github.com/Bitshala-Incubator/silent-pay-wallet"
  s.license      = package["license"] || "MIT"
  s.authors      = { "bitshala" => "dev@bitshala.org" }
  
  s.platforms    = { :ios => "13.0" }
  s.source       = { :git => ".git", :tag => "#{s.version}" }
  
  s.source_files = "RustJsiBridge/**/*.{h,m,mm,cpp}"
  s.public_header_files = "RustJsiBridge/**/*.h"
  
  # Link Rust static libraries. Built by `npm run rust:build`, which writes
  # the xcframework here (alongside this podspec). See README iOS section.
  s.vendored_frameworks = "RustJsiBridge.xcframework"
  
  s.dependency "React-Core"
  
  # install_modules_dependencies(s) # This helper is usually for Podfile, not podspec.
end

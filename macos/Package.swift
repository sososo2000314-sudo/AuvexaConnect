// swift-tools-version: 5.7
import PackageDescription
let package = Package(
    name: "AuvexaConnectMac",
    platforms: [.macOS(.v10_15)],
    products: [.executable(name: "AuvexaConnectMac", targets: ["AuvexaConnectMac"])],
    targets: [.executableTarget(name: "AuvexaConnectMac")]
)

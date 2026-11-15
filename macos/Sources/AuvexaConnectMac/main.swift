import SwiftUI

@main
struct AuvexaConnectMacApp: App {
    var body: some Scene {
        WindowGroup { MainView().frame(minWidth: 900, minHeight: 620) }
    }
}

struct MainView: View {
    private let menu = ["ホーム", "投稿", "フレンド", "チャット", "掲示板", "劇場",
                        "オンライン教室", "世界交流マップ", "作品展示", "イベント",
                        "百科事典", "通知センター", "マイページ", "設定"]
    @State private var selected = "ホーム"

    var body: some View {
        NavigationView {
            List(menu, id: \.self, selection: $selected) { Text($0) }
                .listStyle(SidebarListStyle())
            VStack(spacing: 16) {
                Text("AuvexaConnect").font(.system(size: 34, weight: .bold))
                Text(selected).font(.title)
                Text("Mac版 開発基盤")
                Text("各機能は docs/SPEC_INDEX.md の仕様を保持して順次実装します。")
                    .foregroundColor(.secondary)
                Spacer()
                Text("現在は起動骨格です。完成版ではありません。")
                    .font(.footnote).foregroundColor(.secondary)
            }.padding(36)
        }
    }
}

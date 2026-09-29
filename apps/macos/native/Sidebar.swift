import SwiftUI

/// Project disclosure state is independent of the selected chat.
struct ProjectTree: View {
  @ObservedObject var desk: Desk
  let rename: (DeskTask) -> Void
  let trash: (DeskTask) -> Void
  @AppStorage("collapsedProjects") private var collapsedJSON = "[]"
  @AppStorage("reduceAnimations") private var reduceAnimations = false
  @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
  private var collapsed: Set<String> {
    Set((try? JSONDecoder().decode([String].self, from: Data(collapsedJSON.utf8))) ?? [])
  }
  private func setExpanded(_ expanded: Bool, project: String) {
    var ids = collapsed
    if expanded { ids.remove(project) } else { ids.insert(project) }
    if let data = try? JSONEncoder().encode(ids.sorted()),
      let value = String(data: data, encoding: .utf8)
    {
      collapsedJSON = value
    }
  }
  var body: some View {
    ScrollView {
      LazyVStack(alignment: .leading, spacing: 14) {
        ForEach(desk.projects) { project in
          let expanded = !collapsed.contains(project.id)
          let tasks = desk.tasks.filter { $0.projectID == project.id && $0.active }
          VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 2) {
              Button {
                withAnimation(
                  systemReduceMotion || reduceAnimations ? nil : .easeInOut(duration: 0.18)
                ) {
                  setExpanded(!expanded, project: project.id)
                }
              } label: {
                HStack(spacing: 7) {
                  Image(systemName: "chevron.right").font(.system(size: 8, weight: .semibold))
                    .rotationEffect(.degrees(expanded ? 90 : 0)).frame(width: 10)
                    .foregroundStyle(.secondary)
                  Image(systemName: expanded ? "folder" : "folder.fill")
                    .font(.system(size: 12)).foregroundStyle(Color(white: 0.65))
                  Text(project.name).font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color(white: 0.81)).lineLimit(1).truncationMode(.middle)
                  Spacer(minLength: 0)
                  if !expanded && !tasks.isEmpty {
                    Text("\(tasks.count)").font(.system(size: 10)).monospacedDigit()
                      .foregroundStyle(.secondary)
                  }
                }.padding(.leading, 7).padding(.trailing, 3).frame(height: 30)
                  .contentShape(Rectangle())
              }.buttonStyle(SidebarSurface())
                .help(project.path)
                .accessibilityLabel(project.name)
                .accessibilityValue(expanded ? "Ausgeklappt" : "Eingeklappt")
                .accessibilityHint("Projekt ein- oder ausklappen")
              Button {
                setExpanded(true, project: project.id)
                desk.run { try await desk.newTask(projectID: project.id) }
              } label: {
                Image(systemName: "plus").font(.system(size: 11)).foregroundStyle(.secondary)
                  .frame(width: 25, height: 28).contentShape(Rectangle())
              }.buttonStyle(SidebarSurface()).help("Neue Aufgabe in \(project.name)")
                .accessibilityLabel("Neue Aufgabe in \(project.name)")
            }
            if expanded {
              ForEach(tasks) { task in
                Button {
                  Task { await desk.select(task.id) }
                } label: {
                  HStack(spacing: 8) {
                    Image(systemName: "text.bubble").font(.system(size: 11))
                      .foregroundStyle(
                        desk.selected == task.id ? Color(white: 0.82) : Color(white: 0.5))
                    Text(task.title).font(.system(size: 12))
                      .foregroundStyle(
                        desk.selected == task.id ? Color(white: 0.95) : Color(white: 0.7)
                      )
                      .lineLimit(2).multilineTextAlignment(.leading)
                    Spacer(minLength: 2)
                    if task.busy {
                      Circle().fill(Color(red: 0.73, green: 0.81, blue: 0.72)).frame(
                        width: 5, height: 5)
                    }
                  }.padding(.horizontal, 10).padding(.vertical, 9)
                    .frame(maxWidth: .infinity, minHeight: 33, alignment: .leading)
                    .contentShape(Rectangle())
                }.buttonStyle(SidebarSurface(selected: desk.selected == task.id))
                  .padding(.leading, 23)
                  .help(task.title)
                  .accessibilityAddTraits(desk.selected == task.id ? .isSelected : [])
                  .contextMenu {
                    Button("Umbenennen …") { rename(task) }
                    Button("Archivieren", systemImage: "archivebox") {
                      desk.run { try await desk.changeTaskState(task.id, action: "archive") }
                    }.disabled(task.busy)
                    Button("In den Papierkorb …", systemImage: "trash", role: .destructive) {
                      trash(task)
                    }.disabled(task.busy)
                    Divider()
                    Button("Neue Aufgabe") {
                      desk.run { try await desk.newTask(projectID: project.id) }
                    }
                  }
              }
              if tasks.isEmpty {
                Text("Noch keine Chats").font(.system(size: 11)).foregroundStyle(.secondary)
                  .padding(.leading, 34).padding(.vertical, 8)
              }
            }
          }
        }
      }.padding(.horizontal, 10).padding(.top, 5).padding(.bottom, 16)
    }.scrollIndicators(.hidden)
      .onChange(of: desk.selected) { old, id in
        if old != nil, let project = desk.tasks.first(where: { $0.id == id })?.projectID {
          setExpanded(true, project: project)
        }
      }
  }
}

private struct SidebarSurface: ButtonStyle {
  var selected = false
  func makeBody(configuration: Configuration) -> some View {
    Content(configuration: configuration, selected: selected)
  }
  private struct Content: View {
    let configuration: ButtonStyle.Configuration
    let selected: Bool
    @State private var hovered = false
    var body: some View {
      configuration.label
        .background(
          Color.white.opacity(
            configuration.isPressed ? 0.12 : selected ? 0.085 : hovered ? 0.045 : 0),
          in: RoundedRectangle(cornerRadius: 7)
        )
        .onHover { hovered = $0 }
    }
  }
}

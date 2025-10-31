import MindMap from '@/components/Graph/MindMap'
import Insights from '@/components/Panel/Insights'
import Chat from '@/components/AI/Chat'

export default function HomePage() {
  return (
    <main className="flex flex-col h-screen overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <section className="flex-[5] bg-white min-w-[80%] relative overflow-hidden pointer-events-auto">
          <MindMap />
        </section>
        <aside className="flex-[1] min-w-[20%] max-w-[350px] border-l bg-gray-50 overflow-hidden flex flex-col pointer-events-auto">
          <Insights />
        </aside>
      </div>
      {/* Chat is now a floating popup, no need for a section */}
        <Chat />
    </main>
  )
}



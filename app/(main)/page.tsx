import MindMap from '@/components/Graph/MindMap'
import Insights from '@/components/Panel/Insights'
import Chat from '@/components/AI/Chat'

export default function HomePage() {
  return (
    <main className="flex flex-col h-screen">
      <div className="flex flex-1 overflow-hidden">
        <section className="flex-[4] bg-white min-w-[80%]">
          <MindMap />
        </section>
        <aside className="flex-[1] min-w-[20%] border-l bg-gray-50">
          <Insights />
        </aside>
      </div>
      <section className="border-t bg-white">
        <Chat />
      </section>
    </main>
  )
}



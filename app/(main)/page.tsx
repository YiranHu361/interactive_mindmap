import MindMap from '@/components/Graph/MindMap'
import DetailsPanel from '@/components/Panel/DetailsPanel'
import Chat from '@/components/AI/Chat'

export default function HomePage() {
  return (
    <main className="flex flex-col h-screen">
      <div className="flex flex-1 overflow-hidden">
        <section className="flex-1 bg-white">
          <MindMap />
        </section>
        <aside className="w-96 border-l bg-gray-50">
          <DetailsPanel />
        </aside>
      </div>
      <section className="border-t bg-white">
        <Chat />
      </section>
    </main>
  )
}



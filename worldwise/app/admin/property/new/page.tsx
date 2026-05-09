import PropertyForm from '../PropertyForm'

export default function NewPropertyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy text-white px-8 py-4 flex items-center gap-4">
        <a href="/admin" className="text-white/60 hover:text-white text-sm">← Back</a>
        <span className="font-serif text-xl">Add New Property</span>
      </header>
      <div className="max-w-3xl mx-auto px-8 py-10">
        <PropertyForm />
      </div>
    </div>
  )
}

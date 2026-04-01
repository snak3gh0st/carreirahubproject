import EnrollForm from "./EnrollForm";

export default function EnrollPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-brand-verde">Matricular Aluno</h1>
        <p className="text-sm text-gray-500 mt-1">Crie uma nova matrícula no programa de mentoria.</p>
      </div>
      <EnrollForm />
    </div>
  );
}

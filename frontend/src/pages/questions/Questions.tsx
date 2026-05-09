import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';

interface Question {
  _id: string;
  question: string;
  type: string;
  difficulty: string;
  skills: string[];
  options?: string[];
  correctAnswer?: string;
  category: string;
  createdAt: string;
}

export default function Questions() {
  const user = useAuthStore((state) => state.user);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [newQuestion, setNewQuestion] = useState({
    question: '',
    type: 'multiple_choice',
    difficulty: 'medium',
    category: 'technical',
    skills: [] as string[],
    options: ['', '', '', ''],
    correctAnswer: '',
  });

  const [skillInput, setSkillInput] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, [filter]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const url = filter === 'all' ? '/questions' : `/questions?difficulty=${filter}`;
      const response = await apiClient.get(url);
      setQuestions((response.data as any) || []);
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newQuestion.question) {
      setMessage({ type: 'error', text: 'Question text is required' });
      return;
    }

    try {
      await apiClient.post('/questions', newQuestion);
      setMessage({ type: 'success', text: 'Question created successfully!' });
      setShowCreateModal(false);
      setNewQuestion({
        question: '',
        type: 'multiple_choice',
        difficulty: 'medium',
        category: 'technical',
        skills: [],
        options: ['', '', '', ''],
        correctAnswer: '',
      });
      fetchQuestions();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to create question',
      });
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      await apiClient.delete(`/questions/${id}`);
      setMessage({ type: 'success', text: 'Question deleted successfully!' });
      fetchQuestions();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to delete question',
      });
    }
  };

  const addSkill = () => {
    if (skillInput.trim() && !newQuestion.skills.includes(skillInput.trim())) {
      setNewQuestion({ ...newQuestion, skills: [...newQuestion.skills, skillInput.trim()] });
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setNewQuestion({ ...newQuestion, skills: newQuestion.skills.filter((s) => s !== skill) });
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800',
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-800';
  };

  if (user?.role !== 'employer' && user?.role !== 'admin' && user?.role !== 'hr') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-gray-600">Only HR, Admin, or Employer roles can manage questions.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Question Bank</h1>
          <p className="text-gray-600 mt-1">Manage interview questions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          + Add Question
        </button>
      </div>

      {message.text && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {['all', 'easy', 'medium', 'hard'].map((difficulty) => (
          <button
            key={difficulty}
            onClick={() => setFilter(difficulty)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
              filter === difficulty
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            {difficulty}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No questions found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating your first question</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((question) => (
            <div key={question._id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                      {question.difficulty}
                    </span>
                    <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium capitalize">
                      {question.type.replace(/_/g, ' ')}
                    </span>
                    <span className="px-2 py-1 rounded bg-purple-100 text-purple-800 text-xs font-medium capitalize">
                      {question.category}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-medium text-gray-900">{question.question}</h3>
                  
                  {question.options && question.options.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {question.options.map((option, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span>{option}</span>
                          {option === question.correctAnswer && (
                            <span className="text-green-600 text-xs">✓ Correct</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {question.skills && question.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {question.skills.map((skill, idx) => (
                        <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="mt-2 text-xs text-gray-500">
                    Created on {new Date(question.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <button
                  onClick={() => handleDeleteQuestion(question._id)}
                  className="ml-4 text-red-600 hover:text-red-800"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Question Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Create New Question</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateQuestion} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newQuestion.question}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                    <select
                      value={newQuestion.type}
                      onChange={(e) => setNewQuestion({ ...newQuestion, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="coding">Coding</option>
                      <option value="descriptive">Descriptive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
                    <select
                      value={newQuestion.difficulty}
                      onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={newQuestion.category}
                      onChange={(e) => setNewQuestion({ ...newQuestion, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="technical">Technical</option>
                      <option value="behavioral">Behavioral</option>
                      <option value="aptitude">Aptitude</option>
                    </select>
                  </div>
                </div>

                {newQuestion.type === 'multiple_choice' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                      {newQuestion.options.map((option, idx) => (
                        <input
                          key={idx}
                          type="text"
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...newQuestion.options];
                            newOptions[idx] = e.target.value;
                            setNewQuestion({ ...newQuestion, options: newOptions });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-2"
                          placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        />
                      ))}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
                      <select
                        value={newQuestion.correctAnswer}
                        onChange={(e) => setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">Select correct answer</option>
                        {newQuestion.options.filter(opt => opt).map((option, idx) => (
                          <option key={idx} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Enter a skill and press Enter"
                    />
                    <button
                      type="button"
                      onClick={addSkill}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newQuestion.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm flex items-center gap-1"
                      >
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)} className="hover:text-indigo-900">
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                  >
                    Create Question
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

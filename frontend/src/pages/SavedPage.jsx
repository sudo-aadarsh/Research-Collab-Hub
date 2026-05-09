/**
 * pages/SavedPage.jsx
 * Saved papers and projects collection page.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, BookOpen, FolderOpen, Clock, Users, ExternalLink, Search, Bookmark } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Card, CardHeader, CardBody, Badge, Button, SectionTitle, PageLoader
} from '../components/Shared/UI';
import { useSavedStore } from '../store';
import { format } from 'date-fns';

export default function SavedPage() {
  const navigate = useNavigate();
  const { savedPapers, savedProjects, unsavePaper, unsaveProject } = useSavedStore();
  const [tab, setTab] = useState('papers'); // 'papers' or 'projects'
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Filter based on search
  const filteredPapers = savedPapers.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.abstract?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProjects = savedProjects.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeletePaper = (id) => {
    unsavePaper(id);
    setShowDeleteConfirm(null);
    toast.success('Paper removed from saved items');
  };

  const handleDeleteProject = (id) => {
    unsaveProject(id);
    setShowDeleteConfirm(null);
    toast.success('Project removed from saved items');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <Bookmark size={32} />
            <h1 className="text-3xl font-bold">Saved Items</h1>
          </div>
          <p className="text-indigo-100">Your collection of saved papers and projects</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-200">
          <button
            onClick={() => setTab('papers')}
            className={`px-4 py-3 text-sm font-medium transition ${
              tab === 'papers'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen size={18} />
              <span>Saved Papers ({savedPapers.length})</span>
            </div>
          </button>
          <button
            onClick={() => setTab('projects')}
            className={`px-4 py-3 text-sm font-medium transition ${
              tab === 'projects'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <FolderOpen size={18} />
              <span>Saved Projects ({savedProjects.length})</span>
            </div>
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${tab === 'papers' ? 'papers' : 'projects'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Papers Tab */}
        {tab === 'papers' && (
          <div>
            {filteredPapers.length === 0 ? (
              <Card>
                <CardBody className="text-center py-12">
                  <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 text-lg mb-2">
                    {savedPapers.length === 0 ? 'No saved papers yet' : 'No papers match your search'}
                  </p>
                  <p className="text-slate-400 text-sm mb-4">
                    Save papers from the Papers section to see them here
                  </p>
                  <Button onClick={() => navigate('/papers')} className="bg-indigo-600 hover:bg-indigo-700">
                    Browse Papers
                  </Button>
                </CardBody>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredPapers.map((paper) => (
                  <Card key={paper.id} className="hover:shadow-md transition">
                    <CardBody>
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => navigate(`/papers/${paper.id}`)}
                            className="text-lg font-semibold text-indigo-600 hover:text-indigo-700 hover:underline text-left mb-2"
                            title={paper.title}
                          >
                            {paper.title.length > 100 ? `${paper.title.substring(0, 100)}...` : paper.title}
                          </button>
                          
                          {paper.abstract && (
                            <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                              {paper.abstract}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            {paper.authors && paper.authors.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users size={14} />
                                {paper.authors.slice(0, 2).map(a => a.author_name).join(', ')}
                                {paper.authors.length > 2 && ` +${paper.authors.length - 2}`}
                              </span>
                            )}
                            {paper.created_at && (
                              <span className="flex items-center gap-1">
                                <Clock size={14} />
                                {format(new Date(paper.created_at), 'MMM dd, yyyy')}
                              </span>
                            )}
                            {paper.savedAt && (
                              <span className="text-indigo-600 font-medium">
                                Saved {format(new Date(paper.savedAt), 'MMM dd')}
                              </span>
                            )}
                          </div>

                          {paper.keywords && paper.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {paper.keywords.slice(0, 3).map(kw => (
                                <Badge key={kw} color="indigo" className="text-xs">
                                  {kw}
                                </Badge>
                              ))}
                              {paper.keywords.length > 3 && (
                                <Badge color="slate" className="text-xs">
                                  +{paper.keywords.length - 3} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => navigate(`/papers/${paper.id}`)}
                            icon={ExternalLink}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowDeleteConfirm({ type: 'paper', id: paper.id })}
                            icon={Trash2}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          />
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Projects Tab */}
        {tab === 'projects' && (
          <div>
            {filteredProjects.length === 0 ? (
              <Card>
                <CardBody className="text-center py-12">
                  <FolderOpen size={48} className="mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 text-lg mb-2">
                    {savedProjects.length === 0 ? 'No saved projects yet' : 'No projects match your search'}
                  </p>
                  <p className="text-slate-400 text-sm mb-4">
                    Save projects from the Projects section to see them here
                  </p>
                  <Button onClick={() => navigate('/projects')} className="bg-indigo-600 hover:bg-indigo-700">
                    Browse Projects
                  </Button>
                </CardBody>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProjects.map((project) => (
                  <Card key={project.id} className="hover:shadow-md transition">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-slate-800 flex-1 line-clamp-2">
                          {project.title}
                        </h3>
                      </div>
                    </CardHeader>
                    <CardBody className="space-y-3">
                      {project.description && (
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {project.description}
                        </p>
                      )}

                      <div className="flex gap-2 text-xs text-slate-500">
                        {project.members && (
                          <span className="flex items-center gap-1">
                            <Users size={14} />
                            {project.members.length} member{project.members.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {project.created_at && (
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {format(new Date(project.created_at), 'MMM dd, yyyy')}
                          </span>
                        )}
                        {project.savedAt && (
                          <span className="text-indigo-600 font-medium">
                            Saved {format(new Date(project.savedAt), 'MMM dd')}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1"
                          onClick={() => navigate(`/projects/${project.id}`)}
                        >
                          View Project
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowDeleteConfirm({ type: 'project', id: project.id })}
                          icon={Trash2}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        />
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-sm w-full">
              <CardBody className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <Trash2 size={20} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">
                    Remove this {showDeleteConfirm.type === 'paper' ? 'paper' : 'project'} from saved items?
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => {
                      if (showDeleteConfirm.type === 'paper') {
                        handleDeletePaper(showDeleteConfirm.id);
                      } else {
                        handleDeleteProject(showDeleteConfirm.id);
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

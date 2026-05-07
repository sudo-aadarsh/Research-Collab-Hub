# Paper Upload Feature Guide

Your Research Collab Hub now supports **three ways to create papers**: manual entry, file upload from device, and Google Drive integration.

## New Features Added

### 1. **Enhanced Paper Creation Modal**

The "Create New Paper" modal now has three tabs:

#### Tab 1: Manual Entry (Default)
- Enter paper details manually
- Title, Abstract, Keywords
- Same as before but with improved UI

#### Tab 2: Upload from Device 💾
- Drag & drop or click to upload
- Supported formats: PDF, Word (.doc, .docx), Text (.txt)
- File size limit: 50MB
- **Automatic text extraction**: The system extracts text from your file and uses it as the paper abstract
- Great for: Adding papers you've already written

#### Tab 3: Google Drive ☁️
- "Select from Google Drive" button (placeholder for OAuth integration)
- Works with files stored in your Google Drive
- Same supported formats as device upload
- Feature coming soon: Full OAuth flow integration

### 2. **Backend File Processing**

New endpoint: `POST /api/v1/papers/upload`

Features:
- ✅ Multipart form-data file upload handling
- ✅ Automatic text extraction from PDF/Word documents
- ✅ Fallback support for plain text files
- ✅ Smart abstract generation from file content
- ✅ User becomes first author automatically
- ✅ Keyword and metadata support

## How to Use

### Creating a Paper from Your Device

1. **Open the Papers page** → Click "Add Paper" button
2. **Click "From Device" tab**
3. **Upload your file**:
   - Click the upload area or drag & drop your PDF/Word document
   - File preview shows after selection
4. **Fill in the form**:
   - Title (required)
   - Keywords (comma-separated, optional)
   - Abstract (auto-filled from first 500 chars of file)
5. **Click "Upload & Create"**

The system will:
- Extract text from your document
- Create the paper with extracted content as abstract
- Add you as the corresponding author
- Store important metadata

### Creating a Paper Manually

1. **Open the Papers page** → Click "Add Paper" button
2. **Stay on "Manual Entry" tab**
3. **Fill in:**
   - Title (required)
   - Abstract (optional)
   - Keywords (comma-separated)
4. **Click "Create Paper"**

### Using Google Drive (Coming Soon)

1. **Open the Papers page** → Click "Add Paper" button
2. **Click "Google Drive" tab**
3. **Click "Select from Google Drive"**
4. **Authenticate** with your Google account
5. **Select a file** from your Drive
6. **Confirm** the paper details
7. **Click "Upload & Create"**

## File Format Support

| Format | Status | Details |
|--------|--------|---------|
| PDF (.pdf) | ✅ Supported | Text extracted automatically |
| Word (.docx) | ✅ Supported | Requires `python-docx` library |
| Word (.doc) | ✅ Supported | Requires `python-docx` library |
| Text (.txt) | ✅ Supported | Uploaded as plain text |
| Other formats | ❌ Not supported | Upload via manual entry instead |

## Technical Details

### Frontend Changes
- **File**: `frontend/src/pages/PapersPage.jsx`
- **Component**: `CreatePaperModal`
- New imports: `useRef` hook, `Upload` and `Cloud` icons
- Features:
  - Three-tab interface with state management
  - File drag-and-drop support
  - File type validation (PDF, DOCX, DOC)
  - File size validation (50MB limit)
  - User-friendly error messages

### Backend Changes
- **File**: `backend/modules/papers/routes.py`
- **New Endpoint**: `POST /papers/upload`
- Features:
  - Multipart form-data handling
  - Automatic text extraction (PDF, DOCX, TXT)
  - JSON keyword parsing
  - Auto-author assignment
  - Paper creation with file metadata

### API Client Updates
- **File**: `frontend/src/api/client.js`
- New method: `papersAPI.createWithFile(formData)`
- Uses `multipart/form-data` content type automatically

## Future Enhancements

### Google Drive OAuth Integration
To fully enable Google Drive:
1. Setup Google Cloud Project
2. Create OAuth 2.0 credentials
3. Add Google Drive API scope
4. Implement OAuth flow in frontend
5. Handle redirect and token exchange

### Advanced Features
- [ ] Extract metadata from PDFs (authors, publication date)
- [ ] Automatic keyword extraction from content
- [ ] OCR for scanned documents
- [ ] Integration with Zotero/Mendeley
- [ ] DOI lookup and auto-population
- [ ] arXiv/PubMed import

## Troubleshooting

### "File upload failed"
- Check file format is supported (PDF, DOCX, DOC, TXT)
- Check file size is under 50MB
- Try with a smaller file first

### "Abstract is empty"
- System will auto-extract first 500 characters from your file
- If extraction fails, abstract stays empty
- You can edit and add abstract after creation

### "Keywords not working"
- Enter as comma-separated values: `machine learning, NLP, transformers`
- Or keep empty if you prefer to add them later

### "Text extraction not working"
- Advanced PDF extraction requires `PyPDF2` library (optional)
- Advanced Word extraction requires `python-docx` library (optional)
- Basic support is built-in; install optional libraries for better results

## Installation of Optional Libraries

To enable full PDF and Word document extraction:

```bash
# In your backend container or venv
pip install PyPDF2 python-docx
```

Then update `backend/requirements.txt`:
```
PyPDF2==4.0.0
python-docx==0.8.11
```

And restart:
```bash
docker-compose down
docker-compose up -d
```

## Security Notes

- ✅ Files are not permanently stored on server (only text extracted)
- ✅ File uploads are rate-limited (50MB max)
- ✅ Only authenticated users can upload
- ✅ Files processed server-side (no client-side execution)
- ✅ Sensitive content in PDFs should be reviewed before sharing

## API Reference

### Create Paper with File Upload

**Endpoint**: `POST /api/v1/papers/upload`

**Request**:
```bash
curl -X POST http://localhost:8000/api/v1/papers/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=My Research Paper" \
  -F "abstract=Optional abstract" \
  -F "keywords=[\"ai\", \"ml\"]" \
  -F "file=@/path/to/paper.pdf"
```

**Response** (201 Created):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "My Research Paper",
  "abstract": "Extracted text from PDF...",
  "keywords": ["ai", "ml"],
  "status": "draft",
  "version": 1,
  "authors": [
    {
      "user_id": "...",
      "author_name": "Your Name",
      "author_email": "you@example.com",
      "is_corresponding": true
    }
  ],
  "created_at": "2025-01-15T10:30:00+00:00",
  "updated_at": "2025-01-15T10:30:00+00:00"
}
```

**Field Details**:
- `title` (required): Paper title
- `abstract` (optional): Paper abstract (auto-filled from file if not provided)
- `keywords` (optional): JSON array of keywords
- `project_id` (optional): UUID of associated project
- `file` (optional): PDF, DOCX, DOC, or TXT file

## Testing

Try it now:
1. Open http://localhost:3001/papers
2. Click "Add Paper"
3. Select "From Device" tab
4. Upload a sample PDF or Word document
5. Watch the paper appear in your list!

---

**Questions or issues?** Check the application logs:
```bash
docker logs rch_backend  # Backend logs
docker logs rch_frontend # Frontend logs
```

# Feature Additions and Fixes

Addressing the 6 requested points across the application to ensure complete functionality.

## Proposed Changes

### 1. Rename 'Blogs' to 'Bloog'
Update all UI labels and references from "Blogs" to "Bloog"
#### [MODIFY] [Sidebar.jsx](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/components/layout/Sidebar.jsx)
- Change "Blogs Sheet" to "Bloog Sheet"
#### [MODIFY] [App.jsx](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/App.jsx)
- Rename references if present
#### [MODIFY] [ManagerPage.jsx](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/pages/Manager/ManagerPage.jsx)
- Rename references to the department in the UI dropdowns
#### [MODIFY] [BlogsSheet.jsx](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/components/features/blogs/BlogsSheet.jsx)
- Ensure all titles say "Bloog"

---
### 2. Client Creation
#### [MODIFY] [ManagerPage.jsx](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/pages/Manager/ManagerPage.jsx)
- Wire up a `＋ Add Client` button in the `Clients` tab (Overview section) to open the `CreateClientModal`.
#### [MODIFY] [CreateClientModal.jsx](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/pages/Manager/CreateClientModal.jsx)
- Verify `onSubmit` properly calls `addClient` from `DataContext` to create the client in Supabase.

---
### 3. Delete functionality in Monthly Planner
#### [MODIFY] [api.js](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/services/api.js)
- Add `delete` function to `planner` object.
#### [MODIFY] [DataContext.jsx](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/context/DataContext.jsx)
- Add `deletePlan` method to context and connect it to `api.planner.delete`.
#### [MODIFY] [MonthlyPlanner.jsx](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/components/features/planner/MonthlyPlanner.jsx)
- Add a delete icon/button to the plan cards.

---
### 4. Meeting creation fix
#### [MODIFY] [MeetingList.jsx](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/components/features/meetings/MeetingList.jsx)
- Verify `addMeeting` logic is triggering correctly. Ensure validation isn't silently failing.
#### [MODIFY] [DataContext.jsx](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/context/DataContext.jsx)
- Ensure `addMeeting` updates the local state array.

---
### 5. Delete functionality in Social Calendar
#### [MODIFY] [api.js](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/services/api.js)
- Ensure `social.delete` exists.
#### [MODIFY] [DataContext.jsx](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/context/DataContext.jsx)
- Add `deleteSocialPost` to context.
#### [MODIFY] [SocialCalendar.jsx](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/components/features/social/SocialCalendar.jsx)
- Add a delete button inside the post viewer/editor modal.

---
### 6. Team Access User Deletion
#### [MODIFY] [DataContext.jsx](file:///c:/Users/ASHA/.gemini/antigravity/scratch/teamflow/teamflow-react/src/context/DataContext.jsx)
- Ensure we call `api.profiles.deleteAllData` (RPC) or handle it through Edge Function safely. Wait, earlier we were using standard RLS, but since we removed the `012_delete_policies.sql`, I will need to provide you the SQL query to run so it successfully deletes them from the `auth.users` tables and `profiles`.

## User Review Required
> [!IMPORTANT]
> The database requires special privileges to delete users entirely from `auth.users`. My plan covers the `profiles` removal (which deletes them from the Team Access table). Please approve this plan and I'll implement these changes immediately!

1. In UI Tasks, in task list, we need a delete button with confirm or cancel.  
Also, it needs a select multiple, select all checkbox with a delete action        
button floated to the right of task category heading. From everwhere that it     
needs to be deleted. Review in depth.
---
2. if i select project in add task form, working directory changes meaning.
Working directory field should be marked as optional with a tooltip to tell its an added      
extension that will be marked in the text if present, not used for CWD. Analyze  
in depth in adapters/providers how CWD works. Project should become source of CWD data truth.                     
---
3. IF we have strategies in place, provider drop down changes meaning. The provider dropwdown should be optional with a tooltip to tell if selected, this will replace the primary's first in list.
---
4. agent mode should be a disabled dropdown only enabling with the selected provider and should be present besides it. Further it should be from a list of latest top 3-5 models provided by the provider (If 5 all, for eg for Ollama since we have only one installed, just that).
---
5. We need an environment flag (set to true for the first time), that marks does initial setup. It loads everything into Postgres. We need a settings screen with subsections. Supervisor loads those, but if DB not available defaults take precedence as they do OR .env file has those vars have higher priority. Further Strategy from getActiveStrategy should read env var and postgres. .env takes precedence, otherwise postgres. 1 should be set into postgres, but could be tweakable and updatable with dropdowns. 
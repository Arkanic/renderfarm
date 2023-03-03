# Spec
Overview of API system used by nodes for server

## /api/join POST
Ask to join renderfarm

Req:
- name string (hostname of machine)

Resp:
- id string (nanoid, use this to contribute frames)
- blenderhash (hash of current blender binary in use)

## /api/leave POST
Leaving (shutdown, worker program end)

Req:
- id string (machine id)

## /api/getjob POST
Get something to do

Req:
- id string (machine id)

Resp:
- available boolean (true if job is available)
- waittime number? (seconds to wait before asking server for more jobs if there is nothing to do)

- dataid string (id/name of zip file)
- chunkid string (id for the piece being rendered)
- frame number (which frame to render)
- range {minX, maxX, minY, maxY} (specify which portion of the image to render)
- settings (will be worked on later, what settings to render with)

## /api/jobfinish POST
Return results of render

Req:
- id string (machine id)
- chunkid string (id of chunk rendered)
- success boolean (did the render finish?)
- statuscode number (code that blender process returned with)
- image data? (if success, return image via this)

Resp:
- valid boolean (did it get accepted?)

## /api/heartbeat POST
Tell the server that you are, infact, still alive

Req:
- id string (machine id)

## /dat/blender GET
Resp:
Currently used blender binary over http

## /dat/job/{id} GET
Resp:
404 if invalid id, 200 with .zip of render contents if valid id
"""Video media library / TV stinger / QR ordering integration."""
import importlib.util, os, sys, tempfile, subprocess
from pathlib import Path
from fastapi.testclient import TestClient

tmp=Path(tempfile.mkdtemp())
os.environ['DATABASE_URL']='sqlite:///'+str(tmp/'test.db')
os.environ['VIDEO_DIR']=str(tmp/'videos')
os.environ['ADMIN_PIN']='test-pin-1234567'
spec=importlib.util.spec_from_file_location('mk_video_testapp',Path(__file__).parent/'app.py')
a=importlib.util.module_from_spec(spec);sys.modules[spec.name]=a;spec.loader.exec_module(a)
PIN={'X-Admin-Key':'test-pin-1234567'}


def test_video_upload_mapping_to_card_then_tv_and_qr():
    sample=tmp/'sample.mp4'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=black:s=320x180:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-shortest','-c:v','libx264','-c:a','aac','-pix_fmt','yuv420p','-y',str(sample)],check=True)
    with TestClient(a.app) as c:
        assert c.get('/admin/videos').status_code==200
        assert c.get('/api/admin/videos').status_code==401
        opts=c.get('/api/admin/videos',headers=PIN).json()['options']
        assert any(x['id']=='bad_lawyer' for x in opts)
        bad=c.post('/api/admin/videos',headers=PIN,data={'title':'Nepareizs','card_id':'bad_lawyer'},files={'file':('x.mp4',b'not real mp4','video/mp4')})
        assert bad.status_code==400
        uploaded=c.post('/api/admin/videos',headers=PIN,data={'title':'AdVOKĀTS','card_id':'bad_lawyer'},files={'file':('bad_lawyer.mp4',sample.read_bytes(),'video/mp4')})
        assert uploaded.status_code==200,uploaded.text
        vid=uploaded.json()['id']
        assert c.get('/media/video/'+vid).status_code==200
        assert c.get('/api/admin/videos',headers=PIN).json()['videos'][0]['available']
        one=c.post('/api/join',json={'room':a.state['room'],'name':'Mārcis'}).json()
        two=c.post('/api/join',json={'room':a.state['room'],'name':'Roberts'}).json()
        assert c.post('/api/admin/start',headers=PIN).status_code==200
        # Force deterministic video by selecting the matching card through temporarily
        # restricting card choices to the one we uploaded for this isolated test.
        previous=a.CARD_DECK[:]
        card=a.CARD_BY_ID['bad_lawyer']
        a.CARD_DECK[:]=[card]
        try:
            call=c.post('/api/admin/call',headers=PIN,json={'kind':'pair','guestId':a.state['guests'][0]['id']})
        finally:
            a.CARD_DECK[:]=previous
        assert call.status_code==200,call.text
        call=call.json()
        assert call['cardId']=='bad_lawyer' and call['videoId']==vid and call['status']=='stinger'
        pub=c.get('/api/state').json()['call']
        assert pub['status']=='stinger' and pub['videoId']==vid and pub['expiresAt'] is None
        unauthorized=c.post('/api/claim',headers={'Authorization':'Bearer '+one['token']},json={'nonce':call['nonce']})
        assert unauthorized.status_code==410
        assert c.post('/api/tv/stinger-finished',json={'callId':call['id']}).status_code==401
        qr=c.post('/api/tv/stinger-finished',headers={'X-TV-Key':a.TV_CONTROL_KEY},json={'callId':call['id']})
        assert qr.status_code==200
        assert c.get('/api/state').json()['call']['status']=='waiting'
        second=c.post('/api/tv/stinger-finished',headers={'X-TV-Key':a.TV_CONTROL_KEY},json={'callId':call['id']})
        assert second.json()=={'ok':False}
        wrong=c.post('/api/claim',headers={'Authorization':'Bearer '+two['token']},json={'nonce':call['nonce']})
        assert wrong.status_code==403
        mission=c.post('/api/claim',headers={'Authorization':'Bearer '+one['token']},json={'nonce':call['nonce']})
        assert mission.status_code==200 and mission.json()['cardId']=='bad_lawyer'
        assert c.delete('/api/admin/videos/'+vid,headers=PIN).status_code==200
        assert c.get('/media/video/'+vid).status_code==404
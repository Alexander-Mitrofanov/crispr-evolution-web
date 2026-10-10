#!/usr/bin/env python3
"""Browser acceptance using an actual native HTTP job's public evidence fixture."""
import argparse
import copy
import json
from pathlib import Path
import re
from urllib.parse import urlsplit
from playwright.sync_api import expect, sync_playwright

ROOT=Path(__file__).resolve().parents[1]
TOKEN='a'*43
TABLE=b'group_id\ttarget_id\tstatus\tcombined_score\tnative_fdr\tnative_hit_count\nsource1\tAY369265.2\tuncalibrated_candidate\t12.24\t\t1\n'


def check(origin,output):
    output.mkdir(parents=True,exist_ok=True)
    fixture=json.loads((ROOT/'tests/fixtures/spacer-association.json').read_text())
    packet=json.loads((ROOT/'tests/fixtures/spacer-association-input.json').read_text())
    fixture['artifacts']=[{'artifact_id':'associations','name':'spacer-associations.tsv','media_type':'text/tab-separated-values','size_bytes':len(TABLE)}]
    state={'advertised':False,'job':fixture,'submissions':[]}
    errors=[]
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True)
        try:
            context=browser.new_context(viewport={'width':1440,'height':1050},accept_downloads=True)
            page=context.new_page()
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.add_init_script("window.cspViolations=[];document.addEventListener('securitypolicyviolation',e=>window.cspViolations.push(e.violatedDirective));")
            def api(route):
                request=route.request;path=urlsplit(request.url).path
                headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type'}
                if request.method=='OPTIONS': route.fulfill(status=204,headers=headers);return
                if path.endswith('/health'): data={'version':'2.9.0'}
                elif path.endswith('/config'): data={'modes':['spacer_association'] if state['advertised'] else ['detection'],'max_total_bases':20000,'max_record_bases':20000,'max_records':1000,'max_request_bytes':100000}
                elif path.endswith('/jobs') and request.method=='POST':
                    payload=request.post_data_json
                    assert payload['mode']=='spacer_association' and payload['association_grouping']=='per_source'
                    assert json.loads(payload['sequence'])==packet and 'reference' not in payload
                    state['submissions'].append(payload)
                    data={'job_id':fixture['job_id'],'access_token':TOKEN,'job':state['job']}
                elif '/jobs/' in path:
                    assert request.headers.get('authorization')=='Bearer '+TOKEN and TOKEN not in request.url
                    if path.endswith('/artifacts/associations'):
                        route.fulfill(status=200,headers=headers,content_type='text/tab-separated-values',body=TABLE);return
                    data=state['job']
                else: raise AssertionError(path)
                route.fulfill(status=202 if request.method=='POST' else 200,headers=headers,content_type='application/json',body=json.dumps(data))
            page.route('https://analysis.example.org/**',api)
            page.goto(origin);page.wait_for_load_state('networkidle')
            expect(page.get_by_role('link',name='Associate spacer groups with phages',exact=True)).to_have_count(0)
            state['advertised']=True;page.reload();page.wait_for_load_state('networkidle')
            page.get_by_role('link',name='Associate spacer groups with phages',exact=True).click()
            input=page.get_by_label('Spacer sequences',exact=True)
            input.fill('>r\nACGT\n')
            expect(page.get_by_role('button',name='Compute',exact=True)).to_be_disabled()
            page.get_by_label('Spacer grouping',exact=True).select_option('per_source')
            expect(page.get_by_role('button',name='Compute',exact=True)).to_be_disabled()
            input.fill(json.dumps(packet))
            page.screenshot(path=output/'grouping-desktop.png',full_page=True)
            page.set_viewport_size({'width':390,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1')
            page.screenshot(path=output/'grouping-mobile.png',full_page=True)
            page.set_viewport_size({'width':1440,'height':1050})
            page.get_by_role('button',name='Compute',exact=True).click()
            page.get_by_role('tab',name='Associations',exact=True).click()
            panel=page.get_by_role('tabpanel',name='Associations',exact=True)
            expect(panel.get_by_text('source1 → AY369265.2',exact=True)).to_be_visible()
            expect(panel.get_by_text('FDR calibration unavailable.',exact=True)).to_be_visible()
            panel.get_by_text('Supporting spacer occurrences and alignments',exact=True).first.click()
            expect(panel.get_by_text(re.compile('Occurrences:.*duplicate'))).to_be_visible()
            page.screenshot(path=output/'desktop.png',full_page=True)
            page.reload();page.wait_for_load_state('networkidle')
            page.get_by_role('tab',name='Files & methods',exact=True).click()
            with page.expect_download() as download:
                page.get_by_role('button',name=re.compile('spacer-associations.tsv')).click()
            saved=output/'spacer-associations.tsv';download.value.save_as(saved);assert saved.read_bytes()==TABLE
            page.set_viewport_size({'width':390,'height':844})
            page.get_by_role('tab',name='Associations',exact=True).click()
            panel.get_by_text('Supporting spacer occurrences and alignments',exact=True).first.click()
            panel.get_by_text('Reference provenance',exact=True).click()
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1')
            page.screenshot(path=output/'mobile.png',full_page=True)
            state['job']=copy.deepcopy(fixture);state['job']['summary']['spacer_association']=None
            page.reload();page.wait_for_load_state('networkidle')
            expect(page.get_by_role('tabpanel',name='Overview',exact=True).get_by_text('A completed association analysis was not reported.')).to_be_visible()
            assert not errors,errors
            assert not page.evaluate('window.cspViolations')
            assert len(state['submissions'])==1
            (output/'acceptance.json').write_text(json.dumps({'status':'passed','api':'intercepted actual native HTTP result and input fixture','checks':['advertisement','explicit grouping required','per-source metadata required','origin-preserving submission','uncalibrated candidate support','duplicate occurrences','reload recovery','protected download','390px alignment/provenance layout','missing evidence','no JS/CSP errors']},indent=2)+'\n')
            print('SpacePHARER browser acceptance passed')
        finally: browser.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--origin',default='http://127.0.0.1:4199');parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();check(args.origin.rstrip('/'),args.output)

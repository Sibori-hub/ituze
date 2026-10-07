<?php

namespace Tests\Feature;

use Tests\TestCase;

class MobileWorkspaceAccessTest extends TestCase
{
    public function test_management_workspace_endpoints_require_mobile_authentication(): void
    {
        foreach ([
            '/api/mobile/dashboard',
            '/api/mobile/workspace/properties',
            '/api/mobile/workspace/cells',
            '/api/mobile/workspace/owners',
            '/api/mobile/workspace/tenants',
            '/api/mobile/workspace/units',
            '/api/mobile/workspace/unit-types',
            '/api/mobile/workspace/leases',
            '/api/mobile/workspace/payments',
            '/api/mobile/workspace/approvals',
        ] as $uri) {
            $this->getJson($uri)->assertUnauthorized();
        }
    }

    public function test_owner_rejection_action_requires_mobile_authentication(): void
    {
        $this->postJson('/api/mobile/workspace/approvals/1/reject')->assertUnauthorized();
    }
}

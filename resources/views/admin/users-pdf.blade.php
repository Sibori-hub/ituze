<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Users Report</title>
    <style>
        @page {
            size: A4 landscape;
            margin: 24px 28px 38px;
        }
    </style>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 10px;
            margin: 0;
            padding: 0;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 16px;
            border-bottom: 2px solid #0E3B2E;
            padding-bottom: 10px;
        }
        .header h1 {
            color: #0E3B2E;
            margin: 0;
            font-size: 20px;
        }
        .header p {
            color: #666;
            margin: 5px 0 0;
            font-size: 11px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            table-layout: fixed;
        }
        thead {
            display: table-header-group;
        }
        tfoot {
            display: table-footer-group;
        }
        tr {
            page-break-inside: avoid;
        }
        th {
            background-color: #0E3B2E;
            color: white;
            padding: 8px 5px;
            text-align: left;
            font-weight: bold;
            font-size: 9px;
            text-transform: uppercase;
        }
        td {
            padding: 7px 5px;
            border-bottom: 1px solid #ddd;
            overflow-wrap: break-word;
            word-wrap: break-word;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .status-approved {
            background-color: #d1fae5;
            color: #065f46;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
        }
        .status-pending {
            background-color: #fef3c7;
            color: #92400e;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
        }
        .status-rejected {
            background-color: #fee2e2;
            color: #991b1b;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
        }
        .role-admin {
            background-color: #ede9fe;
            color: #5b21b6;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
        }
        .role-owner {
            background-color: #dbeafe;
            color: #1e40af;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
        }
        .no-data {
            text-align: center;
            padding: 40px;
            color: #666;
            font-style: italic;
        }
        .footer {
            position: fixed;
            bottom: -22px;
            left: 0;
            right: 0;
            text-align: center;
            color: #666;
            font-size: 9px;
        }
        .footer .page:after {
            content: counter(page);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Users Report</h1>
        <p>Generated on {{ $generatedAt->format('F j, Y, g:i A') }}</p>
        <p>Total users in this report: {{ $users->count() }}</p>
    </div>

    @if($users->isEmpty())
        <div class="no-data">
            No users found matching the current filters.
        </div>
    @else
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>National ID</th>
                    <th>Location</th>
                    <th>Joined</th>
                    <th>Plan expires</th>
                </tr>
            </thead>
            <tbody>
                @foreach($users as $user)
                    <tr>
                        <td>
                            <strong>{{ $user->name }}</strong>
                        </td>
                        <td>{{ $user->email }}</td>
                        <td>{{ $user->phone }}</td>
                        <td>
                            <span class="role-{{ $user->role }}">
                                {{ ucfirst($user->role) }}
                            </span>
                        </td>
                        <td>
                            <span class="status-{{ $user->status }}">
                                {{ ucfirst($user->status) }}
                            </span>
                        </td>
                        <td>
                            @if($user->national_id)
                                {{ $user->identity_document_type === 'passport' ? 'Passport' : 'NIDA' }}: {{ $user->national_id }}
                            @else
                                —
                            @endif
                        </td>
                        <td>
                            @if($user->sector)
                                {{ $user->sector->name }}, {{ $user->sector->district->name ?? '' }}, {{ $user->sector->district->province->name ?? '' }}
                            @else
                                —
                            @endif
                        </td>
                        <td>{{ $user->created_at->format('Y-m-d') }}</td>
                        <td>{{ $user->expires_at ? $user->expires_at->format('Y-m-d') : '—' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    <div class="footer">
        {{ config('app.name') }}<br>
        <small>Powered by Q.R.A GROUP LTD</small> — User Management System · Page <span class="page"></span>
    </div>
</body>
</html>
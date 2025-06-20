import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    const filepath = join(process.cwd(), 'public', 'uploads', 'avatars', filename)
    
    // セキュリティ: パストラバーサル攻撃を防ぐ
    if (filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }
    
    // ファイルの存在確認
    if (!existsSync(filepath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    // ファイルを読み込む
    const fileBuffer = await readFile(filepath)
    
    // MIMEタイプを推測
    let contentType = 'application/octet-stream'
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      contentType = 'image/jpeg'
    } else if (filename.endsWith('.png')) {
      contentType = 'image/png'
    } else if (filename.endsWith('.gif')) {
      contentType = 'image/gif'
    } else if (filename.endsWith('.webp')) {
      contentType = 'image/webp'
    }
    
    // ファイルを返す
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving avatar file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
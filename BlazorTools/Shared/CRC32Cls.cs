using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static BlazorTools.Shared.DataFormate;

namespace BlazorTools.Shared
{
    public class CRC32Cls
    {
        protected ulong[] Crc32Table;
        //生成CRC32码表
        public void GetCRC32Table()
        {
            ulong Crc;
            Crc32Table = new ulong[256];
            int i, j;
            for (i = 0; i < 256; i++)
            {
                Crc = (ulong)i;
                for (j = 8; j > 0; j--)
                {
                    if ((Crc & 1) == 1)
                        Crc = (Crc >> 1) ^ 0xEDB88320;
                    else
                        Crc >>= 1;
                }
                Crc32Table[i] = Crc;
            }
        }

        //获取字符串的CRC32校验值
        public string GetCRC32Str(string sInputString)
        {
            //生成码表
            GetCRC32Table();
            byte[] buffer = StringToHexByte(sInputString);
            ulong value = 0xffffffff;
            int len = buffer.Length;
            for (int i = 0; i < len; i++)
            {
                value = (value >> 8) ^ Crc32Table[(value & 0xFF) ^ buffer[i]];
            }
            return ByteToString(BitConverter.GetBytes((uint)(value ^ 0xffffffff)));
        }

        public static string ByteToString(byte[] arr)
        {
            try
            {
                string str = "";
                foreach (var tmp in arr)
                {
                    str += Convert.ToString(tmp, 16).ToUpper().PadLeft(2, '0') + " ";
                }
                return str;
            }
            catch (Exception ex) { throw (ex); }
        }

        public ulong GetCRC32(byte[] buffer)
        {
            GetCRC32Table();
            ulong value = 0xffffffff;
            int len = buffer.Length;
            for (int i = 0; i < len; i++)
            {
                value = (value >> 8) ^ Crc32Table[(value & 0xFF) ^ buffer[i]];
            }
            return value ^ 0xffffffff;
        }
    }
}

